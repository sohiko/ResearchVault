// Gemini API クライアント

class GeminiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        // 最新のflashモデルを使用
        this.model = 'gemini-2.0-flash-exp';
        this.cache = new Map();
    }

    /**
     * 参照の教科を分類
     */
    async classifySubject(reference) {
        const { title, url } = reference;
        
        // キャッシュチェック
        const cacheKey = `${url}_${title}`;
        if (this.cache.has(cacheKey)) {
            console.log('Using cached classification for:', title);
            return this.cache.get(cacheKey);
        }

        // プロンプト作成
        const prompt = this.createClassificationPrompt(reference);

        try {
            const response = await this.callGeminiAPI(prompt);
            const classification = this.parseClassificationResponse(response);
            
            // キャッシュに保存
            this.cache.set(cacheKey, classification);
            
            return classification;
        } catch (error) {
            console.error('Gemini API classification failed:', error);
            // フォールバック分類
            return this.fallbackClassification(reference);
        }
    }

    /**
     * 複数の参照をバッチ分類
     */
    async classifyBatch(references, onProgress = null) {
        const results = [];
        const batchSize = 3; // レート制限対策
        
        for (let i = 0; i < references.length; i += batchSize) {
            const batch = references.slice(i, i + batchSize);
            
            // 並列処理
            const batchResults = await Promise.allSettled(
                batch.map(ref => this.classifySubject(ref))
            );
            
            // 結果を整形
            const formattedResults = batchResults.map((result, index) => ({
                reference: batch[index],
                classification: result.status === 'fulfilled' 
                    ? result.value 
                    : this.fallbackClassification(batch[index]),
                success: result.status === 'fulfilled'
            }));
            
            results.push(...formattedResults);
            
            // 進捗通知
            if (onProgress) {
                onProgress({
                    processed: i + batch.length,
                    total: references.length,
                    currentBatch: formattedResults
                });
            }
            
            // レート制限対策: バッチ間で1秒待機
            if (i + batchSize < references.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }

    createClassificationPrompt(reference) {
        const { title, url, metadata } = reference;
        
        return `次のWebページを日本の学校教科に分類してください。

タイトル: ${title || 'タイトルなし'}
URL: ${url}
${metadata?.description ? `説明: ${metadata.description}` : ''}
${metadata?.keywords ? `キーワード: ${metadata.keywords}` : ''}

以下の教科から最も適切なものを1つ選んでください：
- 国語
- 数学
- 歴史
- 物理
- 生物
- 化学
- 地理
- 英語
- 音楽
- 美術
- 技術
- 家庭科
- その他

回答は以下のJSON形式のみで返してください（説明文は不要）：
{
  "subject": "教科名",
  "confidence": 0.85,
  "reasoning": "分類理由を簡潔に（50文字以内）"
}`;
    }

    async callGeminiAPI(prompt) {
        const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.2, // 一貫性を重視
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 256, // 短い応答で十分
                    candidateCount: 1
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates in Gemini response');
        }

        const text = data.candidates[0].content.parts[0].text;
        
        return {
            text,
            tokensUsed: data.usageMetadata?.totalTokenCount || 0
        };
    }

    parseClassificationResponse(response) {
        try {
            // JSONを抽出
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const result = JSON.parse(jsonMatch[0]);
            
            // 教科名の検証
            const validSubjects = [
                '国語', '数学', '歴史', '物理', '生物', '化学',
                '地理', '英語', '音楽', '美術', '技術', '家庭科', 'その他'
            ];
            
            if (!validSubjects.includes(result.subject)) {
                console.warn('Invalid subject from AI:', result.subject);
                result.subject = 'その他';
                result.confidence = 0.3;
            }

            return {
                subject: result.subject,
                confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
                reasoning: result.reasoning || '分類理由なし',
                tokensUsed: response.tokensUsed,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Failed to parse Gemini response:', error);
            throw error;
        }
    }

    fallbackClassification(reference) {
        const { title = '', url = '' } = reference;
        const combined = (title + ' ' + url).toLowerCase();

        // 簡易的なキーワードマッチング
        const patterns = {
            '数学': /math|algebra|calculus|geometry|数学|計算|方程式/i,
            '物理': /physics|mechanics|quantum|物理|力学|電磁気/i,
            '化学': /chemistry|chemical|molecule|化学|分子|反応/i,
            '生物': /biology|cell|dna|gene|生物|細胞|遺伝/i,
            '歴史': /history|historical|histor|歴史|戦争|文化/i,
            '地理': /geography|地理|地図|気候/i,
            '英語': /english|英語|grammar|vocabulary/i,
            '国語': /japanese|literature|国語|文学|古典/i,
            '音楽': /music|musical|音楽|楽譜/i,
            '美術': /art|painting|美術|絵画|デザイン/i,
            '技術': /technology|programming|engineering|技術|プログラミング|工学/i,
            '家庭科': /cooking|sewing|家庭科|料理|裁縫/i
        };

        for (const [subject, pattern] of Object.entries(patterns)) {
            if (pattern.test(combined)) {
                return {
                    subject,
                    confidence: 0.6,
                    reasoning: 'キーワードマッチング',
                    tokensUsed: 0,
                    timestamp: new Date().toISOString()
                };
            }
        }

        return {
            subject: 'その他',
            confidence: 0.3,
            reasoning: '分類不可',
            tokensUsed: 0,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * APIキーの検証
     */
    async validateApiKey() {
        try {
            const testPrompt = "これはテストです。「OK」と返答してください。";
            await this.callGeminiAPI(testPrompt);
            return { valid: true };
        } catch (error) {
            return { 
                valid: false, 
                error: error.message 
            };
        }
    }
}

export default GeminiClient;

