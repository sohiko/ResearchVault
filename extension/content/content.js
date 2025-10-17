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
        
        // マウスダウンで選択開始 - ツールチップを隠す
        document.addEventListener('mousedown', (e) => {
            // ツールチップ自体がクリックされた場合は何もしない
            if (e.target.closest('.researchvault-tooltip')) {
                return;
            }
            // それ以外の場合は隠す
            this.hideTooltip();
        });
        
        // 選択解除イベント
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (!selection || selection.toString().trim().length === 0) {
                this.hideTooltip();
            }
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // ハイライトクリック
        document.addEventListener('click', (e) => this.handleHighlightClick(e));
        
        // ページスクロール（ブックマーク表示用）
        window.addEventListener('scroll', () => this.updateBookmarkVisibility());
        
        // ページリサイズ
        window.addEventListener('resize', () => this.updateBookmarkPositions());
        
        // WebページからのメッセージをリッスンしてResearchVault拡張機能の存在を通知
        window.addEventListener('message', (event) => this.handleWebpageMessage(event));
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
        // 少し遅延させて、選択状態を確実にチェック
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText.length > 0) {
                // 選択テキストがある場合、ツールチップを表示
                this.showSelectionTooltip(e, selection);
            } else {
                // 選択がない場合、ツールチップを確実に隠す
                this.hideTooltip();
            }
        }, 10);
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
        
        // Material Iconsのフォントを先に読み込む
        this.loadMaterialIcons().then(() => {
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.className = 'researchvault-tooltip';
            this.tooltipElement.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                padding: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                z-index: 10001;
                display: none;
                font-family: 'Material Icons', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            this.tooltipElement.innerHTML = `
                <button class="save-btn" style="width: 32px; height: 32px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                    <span class="material-icons" style="font-size: 20px;">bookmark_add</span>
                </button>
            `;
            
            const saveBtn = this.tooltipElement.querySelector('.save-btn');
            saveBtn.addEventListener('mouseenter', () => {
                saveBtn.style.background = '#059669';
                saveBtn.style.transform = 'scale(1.05)';
            });
            saveBtn.addEventListener('mouseleave', () => {
                saveBtn.style.background = '#10b981';
                saveBtn.style.transform = 'scale(1)';
            });
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveSelectedText();
            });
            
            document.body.appendChild(this.tooltipElement);
        });
    }

    async loadMaterialIcons() {
        if (document.getElementById('rv-material-icons-font')) {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.id = 'rv-material-icons-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
            link.onload = () => {
                // フォント読み込み完了を待つ
                document.fonts.ready.then(() => {
                    resolve();
                });
            };
            link.onerror = () => {
                // フォールバック：エラー時も続行
                resolve();
            };
            document.head.appendChild(link);
        });
    }

    showSelectionTooltip(e, selection) {
        if (!this.tooltipElement) return;
        
        const text = selection.toString().trim();
        if (text.length === 0) {
            this.hideTooltip();
            return;
        }
        
        // input/textarea要素での選択の場合は表示しない
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        )) {
            this.hideTooltip();
            return;
        }
        
        const x = e.pageX;
        const y = e.pageY;
        
        // 位置調整：より右上に配置
        this.tooltipElement.style.left = `${x + 25}px`;
        this.tooltipElement.style.top = `${y - 50}px`;
        this.tooltipElement.style.display = 'block';
        this.tooltipElement.style.opacity = '1';
        
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
            this.tooltipElement.style.opacity = '0';
            // 確実に非表示にするためにDOMから削除して再追加
            if (this.tooltipElement.parentNode) {
                this.tooltipElement.parentNode.removeChild(this.tooltipElement);
                document.body.appendChild(this.tooltipElement);
            }
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
            
            // ツールチップを即座に隠す
            this.hideTooltip();
            
            // 選択を解除
            selection.removeAllRanges();
            
            // 成功通知
            this.showNotification('選択テキストを保存しました');
        } catch (error) {
            console.error('Failed to save selected text:', error);
            this.hideTooltip();
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
        let retryCount = 0;
        const maxRetries = 3;
        
        const attemptRestore = () => {
            try {
                chrome.runtime.sendMessage({
                    action: 'getBookmarks',
                    data: { url: window.location.href }
                }, (response) => {
                    // Chrome runtime エラーをチェック
                    if (chrome.runtime.lastError) {
                        console.debug('Chrome runtime error:', chrome.runtime.lastError);
                        if (retryCount < maxRetries) {
                            retryCount++;
                            setTimeout(attemptRestore, 1000 * retryCount);
                        }
                        return;
                    }
                    
                    if (response && response.bookmarks && response.bookmarks.length > 0) {
                        this.showBookmarkNavigator(response.bookmarks);
                        
                        // Text Fragments APIでハイライトされたテキストをチェック
                        this.checkTextFragmentHighlight();
                    }
                });
            } catch (error) {
                console.debug('Failed to restore bookmarks:', error);
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(attemptRestore, 1000 * retryCount);
                }
            }
        };
        
        // 初回実行
        attemptRestore();
    }

    checkTextFragmentHighlight() {
        // Text Fragments APIでハイライトされた要素があるか確認
        setTimeout(() => {
            const highlighted = document.querySelector('[data-text-fragment]');
            if (!highlighted) {
                // CSS疑似要素 ::target-text を持つ要素を探す
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_ELEMENT,
                    null,
                    false
                );
                
                let node;
                while (node = walker.nextNode()) {
                    const styles = window.getComputedStyle(node, '::target-text');
                    if (styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                        // Text Fragmentでハイライトされた要素を強調
                        this.highlightTemporarily(node);
                        break;
                    }
                }
            }
        }, 500);
    }

    showBookmarkNavigator(bookmarks) {
        if (document.getElementById('rv-bookmark-navigator')) return;

        const sortedBookmarks = bookmarks.sort((a, b) => 
            (a.scroll_position || 0) - (b.scroll_position || 0)
        );

        const nav = document.createElement('div');
        nav.id = 'rv-bookmark-navigator';
        nav.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 200px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 600;
            color: #374151;
        `;
        header.innerHTML = `
            <span>🔖 ブックマーク (${sortedBookmarks.length})</span>
            <button id="rv-close-nav" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0; color: #6b7280;">×</button>
        `;
        nav.appendChild(header);

        const list = document.createElement('div');
        list.style.cssText = `max-height: 300px; overflow-y: auto;`;
        
        sortedBookmarks.forEach((bookmark, index) => {
            const item = document.createElement('button');
            item.style.cssText = `
                width: 100%;
                text-align: left;
                padding: 8px;
                margin-bottom: 4px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                color: #374151;
                transition: all 0.2s;
            `;
            item.textContent = `${index + 1}. ${bookmark.label || '保存テキスト'}`;
            item.addEventListener('mouseenter', () => {
                item.style.background = '#eff6ff';
                item.style.borderColor = '#3b82f6';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '#f9fafb';
                item.style.borderColor = '#e5e7eb';
            });
            item.addEventListener('click', () => {
                this.scrollToBookmark(bookmark);
            });
            list.appendChild(item);
        });
        nav.appendChild(list);

        document.body.appendChild(nav);

        document.getElementById('rv-close-nav').addEventListener('click', () => {
            nav.remove();
        });
    }

    scrollToBookmark(bookmark) {
        if (bookmark.xpath) {
            const element = this.getElementByXPath(bookmark.xpath);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                this.highlightTemporarily(element);
                return;
            }
        }
        
        // xpathが失敗した場合、テキスト検索でジャンプ
        if (bookmark.text) {
            const found = this.findAndScrollToText(bookmark.text);
            if (found) return;
        }
        
        if (bookmark.scroll_position !== undefined) {
            window.scrollTo({
                top: bookmark.scroll_position,
                behavior: 'smooth'
            });
        }
    }

    findAndScrollToText(text) {
        // 長いテキストの場合は最初の50文字で検索
        const searchText = text.length > 50 ? text.substring(0, 50) : text;
        
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes(searchText)) {
                const element = node.parentElement;
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 要素を少し大きく表示
                const originalElement = element;
                let targetElement = element;
                
                // 親要素で段落やdivなど意味のある要素を探す
                while (targetElement && targetElement !== document.body) {
                    const tagName = targetElement.tagName.toLowerCase();
                    if (['p', 'div', 'article', 'section', 'li', 'td', 'span'].includes(tagName)) {
                        break;
                    }
                    targetElement = targetElement.parentElement;
                }
                
                this.highlightTemporarily(targetElement || originalElement);
                return true;
            }
        }
        return false;
    }

    highlightTemporarily(element) {
        const originalBg = element.style.backgroundColor;
        const originalBorder = element.style.border;
        const originalBoxShadow = element.style.boxShadow;
        
        element.style.backgroundColor = '#fef3c7';
        element.style.border = '2px solid #f59e0b';
        element.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.5)';
        element.style.transition = 'all 0.3s ease';
        element.style.borderRadius = '4px';
        element.style.padding = '4px';
        
        // 3回点滅させる
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            if (blinkCount >= 6) {
                clearInterval(blinkInterval);
                // 元に戻す
                setTimeout(() => {
                    element.style.backgroundColor = originalBg;
                    element.style.border = originalBorder;
                    element.style.boxShadow = originalBoxShadow;
                    element.style.padding = '';
                    element.style.borderRadius = '';
                }, 300);
                return;
            }
            
            if (blinkCount % 2 === 0) {
                element.style.backgroundColor = '#fbbf24';
                element.style.boxShadow = '0 0 30px rgba(251, 191, 36, 0.8)';
            } else {
                element.style.backgroundColor = '#fef3c7';
                element.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.5)';
            }
            blinkCount++;
        }, 300);
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

    handleWebpageMessage(event) {
        if (event.source !== window) return;

        if (event.data.type === 'RESEARCHVAULT_EXTENSION_CHECK' && event.data.source === 'webpage') {
            // 拡張機能の存在を通知
            window.postMessage({
                type: 'RESEARCHVAULT_EXTENSION_RESPONSE',
                source: 'content_script',
                installed: true,
                version: chrome.runtime.getManifest().version
            }, '*');
        }

        if (event.data.type === 'RESEARCHVAULT_AUTH_SYNC' && event.data.source === 'webpage') {
            // 認証データを拡張機能のストレージに保存
            this.syncAuthFromWebpage(event.data.data);
        }

        if (event.data.type === 'RESEARCHVAULT_ANALYZE_HISTORY') {
            // 履歴分析リクエストをbackground scriptに転送
            this.relayAnalyzeHistoryRequest(event.data.data);
        }
    }

    async relayAnalyzeHistoryRequest(data) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeHistory',
                data: data
            });
            
            // 結果をWebページに返す
            window.postMessage({
                type: 'RESEARCHVAULT_ANALYZE_HISTORY_RESPONSE',
                source: 'content_script',
                response: response
            }, '*');
        } catch (error) {
            console.error('Failed to relay analyze history request:', error);
            // エラーもWebページに返す
            window.postMessage({
                type: 'RESEARCHVAULT_ANALYZE_HISTORY_RESPONSE',
                source: 'content_script',
                response: {
                    success: false,
                    error: error.message
                }
            }, '*');
        }
    }

    async syncAuthFromWebpage(authData) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'syncAuthFromWebpage',
                data: authData
            });
            if (response && response.success) {
                console.log('Auth data synced from webpage to extension');
            }
        } catch (error) {
            // エラーは静かに処理（通知しない）
            console.debug('Auth sync skipped (extension context):', error);
        }
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
