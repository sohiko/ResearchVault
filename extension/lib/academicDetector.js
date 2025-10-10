// 学術サイト検出クラス
class AcademicSiteDetector {
    constructor() {
        // 学術系ドメインのリスト
        this.academicDomains = new Set([
            // 学術データベース
            'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'jstor.org',
            'sciencedirect.com', 'springer.com', 'wiley.com', 'nature.com',
            'science.org', 'ieee.org', 'acm.org', 'arxiv.org', 'researchgate.net',
            
            // 日本の学術系
            'jstage.jst.go.jp', 'ci.nii.ac.jp', 'ndl.go.jp',
            'kaken.nii.ac.jp', 'researchmap.jp', 'cinii.ac.jp',
            
            // 大学ドメイン
            '.ac.jp', '.edu', '.ac.uk', '.edu.au',
            
            // ニュース・報道系
            'nytimes.com', 'washingtonpost.com', 'bbc.com', 'cnn.com',
            'reuters.com', 'apnews.com', 'nhk.or.jp', 'nikkei.com',
            'asahi.com', 'mainichi.jp', 'yomiuri.co.jp',
            
            // 百科事典・辞書
            'wikipedia.org', 'britannica.com', 'merriam-webster.com',
            'dictionary.com', 'kotobank.jp', 'weblio.jp',
            
            // 政府・公的機関
            '.gov', '.go.jp', '.gov.uk', 'who.int', 'un.org',
            
            // その他信頼できるソース
            'stackoverflow.com', 'github.com', 'medium.com', 'qiita.com', 'zenn.dev'
        ]);
        
        // 文献的なキーワード
        this.academicKeywords = {
            high: [
                'research', 'study', 'analysis', 'paper', 'journal',
                'abstract', 'methodology', 'conclusion', 'hypothesis',
                'citation', 'reference', 'bibliography', 'doi:',
                '研究', '論文', '考察', '調査', '分析', '学会',
                '報告書', '白書', '統計', 'pdf', '学術', '査読'
            ],
            medium: [
                'report', 'review', 'survey', 'data', 'statistics',
                'findings', 'results', 'evidence', 'theory',
                'レポート', 'データ', '結果', '理論', '実験', '文献'
            ],
            low: [
                'article', 'blog', 'news', 'guide', 'tutorial',
                '記事', 'ニュース', 'ブログ', '解説', 'まとめ'
            ]
        };
        
        // URLパターン
        this.urlPatterns = {
            academic: [
                /\/doi\//i, /\/pdf\//i, /\/article\//i, /\/papers?\//i,
                /\/research\//i, /\/publications?\//i, /\/journal\//i,
                /\/abstract/i, /\.pdf$/i, /\/scholar/i, /\/academic/i
            ],
            negative: [
                /\/tag\//i, /\/category\//i, /\/search/i, /\/login/i,
                /\/cart/i, /\/checkout/i, /\/(ad|ads|advertisement)/i,
                /youtube\.com\/watch/i, /twitter\.com/i, /facebook\.com/i,
                /instagram\.com/i, /tiktok\.com/i
            ]
        };
    }
    
    // メイン判定関数
    async detectAcademicSites(historyItems, options = {}) {
        const results = [];
        
        for (const item of historyItems) {
            const score = this.calculateAcademicScore(item);
            
            if (score.total >= (options.threshold || 0.5)) {
                results.push({
                    ...item,
                    academicScore: score,
                    category: this.categorize(score)
                });
            }
        }
        
        // スコアの高い順にソート
        return results.sort((a, b) => b.academicScore.total - a.academicScore.total);
    }
    
    calculateAcademicScore(historyItem) {
        const { url, title, visitCount, typedCount, lastVisitTime } = historyItem;
        
        const scores = {
            domain: 0,
            url: 0,
            title: 0,
            behavior: 0
        };
        
        try {
            // 1. ドメインスコア
            const domain = new URL(url).hostname;
            if (this.isAcademicDomain(domain)) {
                scores.domain = 1.0;
            } else if (this.hasAcademicTLD(domain)) {
                scores.domain = 0.7;
            }
            
            // 2. URLパターンスコア
            scores.url = this.calculateUrlScore(url);
            
            // 3. タイトルスコア
            scores.title = this.calculateTitleScore(title);
            
            // 4. 行動スコア（訪問回数、直接入力など）
            scores.behavior = this.calculateBehaviorScore({
                visitCount,
                typedCount,
                lastVisitTime
            });
        } catch (error) {
            console.error('Score calculation error:', error);
        }
        
        // 重み付け合計
        const weights = {
            domain: 0.4,
            url: 0.25,
            title: 0.25,
            behavior: 0.1
        };
        
        const total = Object.entries(scores).reduce((sum, [key, value]) => {
            return sum + (value * weights[key]);
        }, 0);
        
        return { ...scores, total };
    }
    
    isAcademicDomain(domain) {
        return Array.from(this.academicDomains).some(academicDomain => {
            if (academicDomain.startsWith('.')) {
                return domain.endsWith(academicDomain);
            }
            return domain === academicDomain || domain.endsWith('.' + academicDomain);
        });
    }
    
    hasAcademicTLD(domain) {
        const academicTLDs = ['.edu', '.ac.jp', '.ac.uk', '.gov', '.go.jp'];
        return academicTLDs.some(tld => domain.endsWith(tld));
    }
    
    calculateUrlScore(url) {
        let score = 0;
        
        // ポジティブパターン
        for (const pattern of this.urlPatterns.academic) {
            if (pattern.test(url)) {
                score += 0.3;
            }
        }
        
        // ネガティブパターン
        for (const pattern of this.urlPatterns.negative) {
            if (pattern.test(url)) {
                score -= 0.3;
            }
        }
        
        return Math.max(0, Math.min(1, score));
    }
    
    calculateTitleScore(title) {
        if (!title) return 0;
        
        const lowerTitle = title.toLowerCase();
        let score = 0;
        
        // キーワードマッチング
        for (const keyword of this.academicKeywords.high) {
            if (lowerTitle.includes(keyword.toLowerCase())) {
                score += 0.4;
            }
        }
        
        for (const keyword of this.academicKeywords.medium) {
            if (lowerTitle.includes(keyword.toLowerCase())) {
                score += 0.2;
            }
        }
        
        // タイトルの特徴
        if (title.includes('|') || title.includes('-') || title.includes(':')) {
            score += 0.1; // 構造化されたタイトル
        }
        
        if (/\d{4}/.test(title)) {
            score += 0.1; // 年号を含む
        }
        
        return Math.max(0, Math.min(1, score));
    }
    
    calculateBehaviorScore({ visitCount, typedCount, lastVisitTime }) {
        let score = 0;
        
        // 複数回訪問
        if (visitCount > 1) {
            score += Math.min(0.3, visitCount * 0.05);
        }
        
        // 直接入力
        if (typedCount > 0) {
            score += 0.2;
        }
        
        // 最近のアクセス
        const daysSinceLastVisit = (Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24);
        if (daysSinceLastVisit < 7) {
            score += 0.2;
        } else if (daysSinceLastVisit < 30) {
            score += 0.1;
        }
        
        return Math.min(1, score);
    }
    
    categorize(score) {
        if (score.domain >= 0.8) return 'academic';
        if (score.total >= 0.7) return 'research';
        if (score.title >= 0.6) return 'article';
        return 'reference';
    }
    
    getSuggestedReason(score, item) {
        const reasons = [];
        
        if (score.domain >= 0.7) {
            reasons.push('学術系ドメイン');
        }
        
        if (score.url >= 0.5) {
            reasons.push('学術的なURLパターン');
        }
        
        if (score.title >= 0.5) {
            reasons.push('研究関連のタイトル');
        }
        
        if (score.behavior >= 0.3) {
            reasons.push('複数回訪問');
        }
        
        if (reasons.length === 0) {
            reasons.push('参考資料候補');
        }
        
        return reasons.join('、');
    }
}

// エクスポート（グローバルスコープで使用可能に）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AcademicSiteDetector;
}

