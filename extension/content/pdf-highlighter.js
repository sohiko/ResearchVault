// PDF highlighter content script
// PDFページでのテキストハイライトと位置情報保存機能

(function() {
  'use strict';

  let selectedText = '';
  let selectedRange = null;
  let currentPage = 1;
  let saveButton = null;

  // PDF.js環境を検出
  function isPDFViewer() {
    return (
      window.PDFViewerApplication !== undefined ||
      document.querySelector('.pdfViewer') !== null ||
      document.location.href.indexOf('.pdf') !== -1
    );
  }

  // テキスト選択時のイベント
  document.addEventListener('mouseup', function(e) {
    if (!isPDFViewer()) {
      return;
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      selectedText = text;
      selectedRange = selection.getRangeAt(0);
      
      // ページ番号を取得
      currentPage = getCurrentPage();
      
      // 保存ボタンを表示
      showSaveButton(e.clientX, e.clientY);
    } else {
      hideSaveButton();
    }
  });

  // 現在のPDFページ番号を取得
  function getCurrentPage() {
    // PDF.js環境
    if (window.PDFViewerApplication && window.PDFViewerApplication.pdfViewer) {
      return window.PDFViewerApplication.pdfViewer.currentPageNumber || 1;
    }

    // ページ番号を含む要素を探す
    const pageIndicator = document.querySelector('.page-indicator, #pageNumber, [aria-label*="Page"]');
    if (pageIndicator) {
      const match = pageIndicator.textContent.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return 1;
  }

  // 選択テキストの位置情報を取得
  function getTextPosition() {
    if (!selectedRange) {
      return null;
    }

    const rect = selectedRange.getBoundingClientRect();
    const pageElement = selectedRange.startContainer.parentElement?.closest('.page, [data-page-number]');
    
    if (!pageElement) {
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    }

    const pageRect = pageElement.getBoundingClientRect();

    return {
      x: rect.left - pageRect.left,
      y: rect.top - pageRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  // 保存ボタンを表示
  function showSaveButton(x, y) {
    hideSaveButton(); // 既存のボタンを削除

    saveButton = document.createElement('button');
    saveButton.textContent = 'ResearchVaultに保存';
    saveButton.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y + 20}px;
      z-index: 999999;
      background: #4F46E5;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: background 0.2s;
    `;

    saveButton.addEventListener('mouseenter', function() {
      saveButton.style.background = '#4338CA';
    });

    saveButton.addEventListener('mouseleave', function() {
      saveButton.style.background = '#4F46E5';
    });

    saveButton.addEventListener('click', function(e) {
      e.stopPropagation();
      saveSelectedText();
    });

    document.body.appendChild(saveButton);

    // 3秒後に自動的に削除
    setTimeout(() => {
      hideSaveButton();
    }, 3000);
  }

  // 保存ボタンを非表示
  function hideSaveButton() {
    if (saveButton) {
      saveButton.remove();
      saveButton = null;
    }
  }

  // 選択テキストをバックグラウンドに送信
  function saveSelectedText() {
    const position = getTextPosition();
    
    // 処理開始メッセージを表示
    showProcessingMessage();
    hideSaveButton();
    
    chrome.runtime.sendMessage({
      type: 'SAVE_PDF_TEXT',
      data: {
        text: selectedText,
        page: currentPage,
        position: position,
        url: window.location.href,
        title: document.title
      }
    }, function(response) {
      if (response && response.success) {
        // 非同期処理開始の確認
        showProcessingMessage('PDF保存処理を開始しました...');
      } else {
        showErrorMessage(response?.error || '保存に失敗しました');
      }
    });
  }

  // バックグラウンドからのメッセージをリッスン
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    switch (message.type) {
      case 'PDF_SAVE_STARTED':
        showProcessingMessage(message.message);
        break;
      case 'PDF_SAVE_COMPLETED':
        showSuccessMessage(message.message);
        break;
      case 'PDF_SAVE_ERROR':
        showErrorMessage(message.error);
        break;
      case 'GET_PDF_SELECTION':
        if (selectedText) {
          sendResponse({
            success: true,
            data: {
              text: selectedText,
              page: currentPage,
              position: getTextPosition(),
              url: window.location.href,
              title: document.title
            }
          });
        } else {
          sendResponse({ success: false, error: 'No PDF selection' });
        }
        break;
    }
  });

  // 処理中メッセージを表示
  function showProcessingMessage(customMessage) {
    // 既存のメッセージを削除
    const existingMessage = document.querySelector('.rv-processing-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const message = document.createElement('div');
    message.className = 'rv-processing-message';
    message.textContent = customMessage || 'PDF保存処理中...';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: #3B82F6;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(message);
  }

  // 成功メッセージを表示
  function showSuccessMessage(customMessage) {
    // 処理中メッセージを削除
    const processingMessage = document.querySelector('.rv-processing-message');
    if (processingMessage) {
      processingMessage.remove();
    }

    const message = document.createElement('div');
    message.textContent = customMessage || '✓ ResearchVaultに保存しました';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: #10B981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(message);

    setTimeout(() => {
      message.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => message.remove(), 300);
    }, 2000);
  }

  // エラーメッセージを表示
  function showErrorMessage(customMessage) {
    // 処理中メッセージを削除
    const processingMessage = document.querySelector('.rv-processing-message');
    if (processingMessage) {
      processingMessage.remove();
    }

    const message = document.createElement('div');
    message.textContent = customMessage || '✗ 保存に失敗しました';
    message.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: #EF4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;

    document.body.appendChild(message);

    setTimeout(() => message.remove(), 2000);
  }

  // スタイルシートを追加（アニメーション用）
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  console.log('ResearchVault PDF highlighter loaded');
})();

