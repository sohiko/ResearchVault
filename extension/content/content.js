// ResearchVault Content Script

class ContentScriptManager {
    constructor() {
        this.highlights = new Map();
        this.bookmarks = new Map();
        this.isInitialized = false;
        this.tooltipElement = null;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('ResearchVault content script initializing...');
        
        // ページが完全に読み込まれてから実行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
        
        this.isInitialized = true;
    }

    async setup() {
        try {
            // メッセージリスナーの設定
            this.setupMessageListeners();
            
            // イベントリスナーの設定
            this.setupEventListeners();
            
            // 既存のハイライトとブックマークを復元
            await this.restoreHighlights();
            await this.restoreBookmarks();
            
            // ツールチップの作成
            this.createTooltip();
            
            console.log('ResearchVault content script initialized');
        } catch (error) {
            console.error('Content script setup failed:', error);
        }
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 非同期レスポンス用
        });
    }

    setupEventListeners() {
        // マウス選択イベント
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // ハイライトクリック
        document.addEventListener('click', (e) => this.handleHighlightClick(e));
        
        // ページスクロール（ブックマーク表示用）
        window.addEventListener('scroll', () => this.updateBookmarkVisibility());
        
        // ページリサイズ
        window.addEventListener('resize', () => this.updateBookmarkPositions());
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'highlightSelection':
                    const result = await this.highlightCurrentSelection(message.data);
                    sendResponse(result);
                    break;
                    
                case 'createBookmark':
                    const bookmark = await this.createBookmarkAtPosition(message.data);
                    sendResponse(bookmark);
                    break;
                    
                case 'removeHighlight':
                    await this.removeHighlight(message.data.id);
                    sendResponse({ success: true });
                    break;
                    
                case 'removeBookmark':
                    await this.removeBookmark(message.data.id);
                    sendResponse({ success: true });
                    break;
                    
                case 'getPageData':
                    const pageData = this.getPageData();
                    sendResponse(pageData);
                    break;
                    
                case 'scrollToBookmark':
                    this.scrollToBookmark(message.data.id);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    handleMouseUp(e) {
        const selection = window.getSelection();
        if (selection.toString().trim().length > 0) {
            // 選択テキストがある場合、ツールチップを表示
            this.showSelectionTooltip(e, selection);
        } else {
            // 選択がない場合、ツールチップを隠す
            this.hideTooltip();
        }
    }

    handleKeyDown(e) {
        // Ctrl+Shift+H: ハイライト作成
        if (e.ctrlKey && e.shiftKey && e.key === 'H') {
            e.preventDefault();
            this.highlightCurrentSelection();
        }
        
        // Ctrl+Shift+B: ブックマーク作成
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            this.createBookmarkAtCurrentPosition();
        }
        
        // Escape: ツールチップを隠す
        if (e.key === 'Escape') {
            this.hideTooltip();
        }
    }

    handleHighlightClick(e) {
        const highlight = e.target.closest('.researchvault-highlight');
        if (highlight) {
            e.preventDefault();
            this.showHighlightInfo(highlight);
        }
    }

    async highlightCurrentSelection(options = {}) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0 || selection.toString().trim().length === 0) {
            return { success: false, error: 'No text selected' };
        }

        try {
            const range = selection.getRangeAt(0);
            const highlightId = this.generateId();
            
            // ハイライト要素を作成
            const highlightElement = document.createElement('mark');
            highlightElement.className = 'researchvault-highlight';
            highlightElement.dataset.highlightId = highlightId;
            highlightElement.style.cssText = `
                background-color: ${options.color || '#ffeb3b'};
                color: inherit;
                padding: 1px 2px;
                border-radius: 2px;
                cursor: pointer;
                transition: background-color 0.2s;
            `;
            
            // 選択範囲をハイライト要素で囲む
            try {
                range.surroundContents(highlightElement);
            } catch (error) {
                // 複雑な選択範囲の場合
                const contents = range.extractContents();
                highlightElement.appendChild(contents);
                range.insertNode(highlightElement);
            }
            
            // ハイライト情報を保存
            const highlightData = {
                id: highlightId,
                text: selection.toString(),
                xpath: this.getXPath(highlightElement),
                url: window.location.href,
                color: options.color || '#ffeb3b',
                note: options.note || '',
                createdAt: new Date().toISOString(),
                position: this.getElementPosition(highlightElement)
            };
            
            this.highlights.set(highlightId, highlightData);
            
            // バックグラウンドスクリプトに保存を依頼
            chrome.runtime.sendMessage({
                action: 'saveHighlight',
                data: highlightData
            });
            
            // 選択を解除
            selection.removeAllRanges();
            this.hideTooltip();
            
            return { success: true, data: highlightData };
        } catch (error) {
            console.error('Failed to create highlight:', error);
            return { success: false, error: error.message };
        }
    }

    async createBookmarkAtCurrentPosition(options = {}) {
        const bookmarkId = this.generateId();
        const scrollPosition = window.scrollY;
        const viewportHeight = window.innerHeight;
        
        // ブックマークアイコンを作成
        const bookmarkElement = document.createElement('div');
        bookmarkElement.className = 'researchvault-bookmark';
        bookmarkElement.dataset.bookmarkId = bookmarkId;
        bookmarkElement.innerHTML = '🔖';
        bookmarkElement.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 24px;
            cursor: pointer;
            z-index: 10000;
            background: white;
            border: 2px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transition: all 0.2s;
        `;
        
        // ホバーエフェクト
        bookmarkElement.addEventListener('mouseenter', () => {
            bookmarkElement.style.transform = 'translateY(-50%) scale(1.1)';
        });
        
        bookmarkElement.addEventListener('mouseleave', () => {
            bookmarkElement.style.transform = 'translateY(-50%) scale(1)';
        });
        
        // クリックイベント
        bookmarkElement.addEventListener('click', () => {
            this.showBookmarkInfo(bookmarkId);
        });
        
        document.body.appendChild(bookmarkElement);
        
        // ブックマーク情報を保存
        const bookmarkData = {
            id: bookmarkId,
            url: window.location.href,
            scrollPosition: scrollPosition,
            viewportHeight: viewportHeight,
            documentHeight: document.documentElement.scrollHeight,
            label: options.label || `ブックマーク ${new Date().toLocaleTimeString()}`,
            note: options.note || '',
            createdAt: new Date().toISOString()
        };
        
        this.bookmarks.set(bookmarkId, {
            data: bookmarkData,
            element: bookmarkElement
        });
        
        // バックグラウンドスクリプトに保存を依頼
        chrome.runtime.sendMessage({
            action: 'saveBookmark',
            data: bookmarkData
        });
        
        return { success: true, data: bookmarkData };
    }

    createTooltip() {
        if (this.tooltipElement) return;
        
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'researchvault-tooltip';
        this.tooltipElement.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        this.tooltipElement.innerHTML = `
            <div class="tooltip-header" style="margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                選択されたテキスト
            </div>
            <div class="tooltip-content" style="margin-bottom: 12px; color: #6b7280; font-size: 12px; max-height: 60px; overflow-y: auto;">
            </div>
            <div class="tooltip-actions" style="display: flex; gap: 8px;">
                <button class="highlight-btn" style="flex: 1; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ハイライト
                </button>
                <button class="save-btn" style="flex: 1; padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    保存
                </button>
            </div>
        `;
        
        // ボタンイベント
        this.tooltipElement.querySelector('.highlight-btn').addEventListener('click', () => {
            this.highlightCurrentSelection();
        });
        
        this.tooltipElement.querySelector('.save-btn').addEventListener('click', () => {
            this.saveSelectedText();
        });
        
        document.body.appendChild(this.tooltipElement);
    }

    showSelectionTooltip(e, selection) {
        if (!this.tooltipElement) return;
        
        const text = selection.toString().trim();
        if (text.length === 0) return;
        
        // ツールチップの内容を更新
        const contentElement = this.tooltipElement.querySelector('.tooltip-content');
        contentElement.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
        
        // 位置を調整
        const x = e.pageX;
        const y = e.pageY;
        
        this.tooltipElement.style.left = `${x + 10}px`;
        this.tooltipElement.style.top = `${y - 60}px`;
        this.tooltipElement.style.display = 'block';
        
        // 画面外に出る場合の調整
        setTimeout(() => {
            const rect = this.tooltipElement.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.tooltipElement.style.left = `${x - rect.width - 10}px`;
            }
            if (rect.top < 0) {
                this.tooltipElement.style.top = `${y + 20}px`;
            }
        }, 0);
    }

    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    async saveSelectedText() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text.length === 0) return;
        
        try {
            // バックグラウンドスクリプトに保存を依頼
            chrome.runtime.sendMessage({
                action: 'saveSelectedText',
                data: {
                    text: text,
                    url: window.location.href,
                    title: document.title,
                    context: this.getSelectionContext(selection)
                }
            });
            
            this.hideTooltip();
            selection.removeAllRanges();
            
            // 成功通知
            this.showNotification('選択テキストを保存しました');
        } catch (error) {
            console.error('Failed to save selected text:', error);
        }
    }

    getSelectionContext(selection) {
        if (selection.rangeCount === 0) return null;
        
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        return {
            before: startContainer.textContent.substring(
                Math.max(0, range.startOffset - 50), 
                range.startOffset
            ),
            after: endContainer.textContent.substring(
                range.endOffset,
                Math.min(endContainer.textContent.length, range.endOffset + 50)
            ),
            xpath: this.getXPath(range.commonAncestorContainer)
        };
    }

    async restoreHighlights() {
        try {
            // バックグラウンドスクリプトから既存のハイライトを取得
            chrome.runtime.sendMessage({
                action: 'getHighlights',
                data: { url: window.location.href }
            }, (response) => {
                if (response && response.highlights) {
                    response.highlights.forEach(highlight => {
                        this.restoreHighlight(highlight);
                    });
                }
            });
        } catch (error) {
            console.error('Failed to restore highlights:', error);
        }
    }

    async restoreBookmarks() {
        try {
            // バックグラウンドスクリプトから既存のブックマークを取得
            chrome.runtime.sendMessage({
                action: 'getBookmarks',
                data: { url: window.location.href }
            }, (response) => {
                if (response && response.bookmarks) {
                    response.bookmarks.forEach(bookmark => {
                        this.restoreBookmark(bookmark);
                    });
                }
            });
        } catch (error) {
            console.error('Failed to restore bookmarks:', error);
        }
    }

    restoreHighlight(highlightData) {
        try {
            const element = this.getElementByXPath(highlightData.xpath);
            if (element) {
                // 既存のハイライトがあるかチェック
                if (!element.querySelector(`[data-highlight-id="${highlightData.id}"]`)) {
                    // ハイライトを復元
                    const highlightElement = document.createElement('mark');
                    highlightElement.className = 'researchvault-highlight';
                    highlightElement.dataset.highlightId = highlightData.id;
                    highlightElement.style.backgroundColor = highlightData.color;
                    highlightElement.textContent = highlightData.text;
                    
                    // テキストマッチングで正確な位置を特定
                    this.insertHighlightAtText(element, highlightData.text, highlightElement);
                }
                
                this.highlights.set(highlightData.id, highlightData);
            }
        } catch (error) {
            console.error('Failed to restore highlight:', error);
        }
    }

    restoreBookmark(bookmarkData) {
        // ブックマークアイコンを再作成
        this.createBookmarkIcon(bookmarkData);
    }

    // ユーティリティメソッド
    generateId() {
        return 'rv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getXPath(element) {
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentNode;
        }
        
        const components = [];
        let child = element;
        
        for (; child && child.nodeType === Node.ELEMENT_NODE; child = child.parentNode) {
            let currentComponent = child.tagName.toLowerCase();
            
            if (child.id) {
                currentComponent += `[@id="${child.id}"]`;
                components.unshift(currentComponent);
                break;
            }
            
            const siblings = Array.from(child.parentNode?.children || [])
                .filter(sibling => sibling.tagName === child.tagName);
            
            if (siblings.length > 1) {
                const index = siblings.indexOf(child) + 1;
                currentComponent += `[${index}]`;
            }
            
            components.unshift(currentComponent);
        }
        
        return `/${components.join('/')}`;
    }

    getElementByXPath(xpath) {
        return document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
    }

    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
    }

    insertHighlightAtText(container, text, highlightElement) {
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            const index = node.textContent.indexOf(text);
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                
                try {
                    range.surroundContents(highlightElement);
                    break;
                } catch (e) {
                    // フォールバック: 単純な置換
                    node.parentNode.insertBefore(highlightElement, node);
                    highlightElement.textContent = text;
                    node.textContent = node.textContent.replace(text, '');
                    break;
                }
            }
        }
    }

    updateBookmarkVisibility() {
        // スクロール位置に応じてブックマークの表示を更新
        this.bookmarks.forEach((bookmark, id) => {
            const element = bookmark.element;
            const data = bookmark.data;
            
            // 現在のスクロール位置との比較
            const currentScroll = window.scrollY;
            const targetScroll = data.scrollPosition;
            const threshold = window.innerHeight * 0.1; // 10% のしきい値
            
            if (Math.abs(currentScroll - targetScroll) < threshold) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(-50%) scale(1.2)';
            } else {
                element.style.opacity = '0.6';
                element.style.transform = 'translateY(-50%) scale(1)';
            }
        });
    }

    updateBookmarkPositions() {
        // ウィンドウリサイズ時にブックマーク位置を調整
        this.bookmarks.forEach((bookmark) => {
            const element = bookmark.element;
            element.style.right = '20px';
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // アニメーション
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 3秒後に削除
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    getPageData() {
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            scrollPosition: window.scrollY,
            documentHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight
        };
    }
}

// コンテンツスクリプトの初期化
const contentScriptManager = new ContentScriptManager();
