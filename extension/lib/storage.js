// ResearchVault Storage Manager for Chrome Extension
console.log('Loading storage.js...');

class StorageManager {
    constructor() {
        this.syncStorage = chrome.storage.sync;
        this.localStorage = chrome.storage.local;
    }

    // 同期ストレージ（設定やユーザー情報用）
    async getSyncData(keys) {
        try {
            if (typeof keys === 'string') {
                keys = [keys];
            }
            return await this.syncStorage.get(keys);
        } catch (error) {
            console.error('Failed to get sync data:', error);
            return {};
        }
    }

    async setSyncData(data) {
        try {
            await this.syncStorage.set(data);
            return true;
        } catch (error) {
            console.error('Failed to set sync data:', error);
            return false;
        }
    }

    async removeSyncData(keys) {
        try {
            if (typeof keys === 'string') {
                keys = [keys];
            }
            await this.syncStorage.remove(keys);
            return true;
        } catch (error) {
            console.error('Failed to remove sync data:', error);
            return false;
        }
    }

    async clearSyncData() {
        try {
            await this.syncStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear sync data:', error);
            return false;
        }
    }

    // ローカルストレージ（大きなデータやキャッシュ用）
    async getLocalData(keys) {
        try {
            if (typeof keys === 'string') {
                keys = [keys];
            }
            return await this.localStorage.get(keys);
        } catch (error) {
            console.error('Failed to get local data:', error);
            return {};
        }
    }

    async setLocalData(data) {
        try {
            await this.localStorage.set(data);
            return true;
        } catch (error) {
            console.error('Failed to set local data:', error);
            return false;
        }
    }

    async removeLocalData(keys) {
        try {
            if (typeof keys === 'string') {
                keys = [keys];
            }
            await this.localStorage.remove(keys);
            return true;
        } catch (error) {
            console.error('Failed to remove local data:', error);
            return false;
        }
    }

    async clearLocalData() {
        try {
            await this.localStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear local data:', error);
            return false;
        }
    }

    // 認証関連
    async getAuthToken() {
        const data = await this.getSyncData('authToken');
        return data.authToken;
    }

    async setAuthToken(token) {
        return await this.setSyncData({ authToken: token });
    }

    async removeAuthToken() {
        return await this.removeSyncData('authToken');
    }

    async getUserInfo() {
        const data = await this.getSyncData('userInfo');
        return data.userInfo;
    }

    async setUserInfo(userInfo) {
        return await this.setSyncData({ userInfo });
    }

    // 設定関連
    async getSettings() {
        const data = await this.getSyncData('settings');
        return data.settings || this.getDefaultSettings();
    }

    async setSettings(settings) {
        return await this.setSyncData({ settings });
    }

    getDefaultSettings() {
        return {
            theme: 'light',
            citationFormat: 'APA',
            autoSave: true,
            notifications: true,
            language: 'ja',
            dashboardUrl: 'https://research-vault.vercel.app'
        };
    }

    // プロジェクト関連
    async getLastSelectedProject() {
        const data = await this.getSyncData('lastSelectedProject');
        return data.lastSelectedProject;
    }

    async setLastSelectedProject(projectId) {
        return await this.setSyncData({ lastSelectedProject: projectId });
    }

    async getProjects() {
        const data = await this.getLocalData('projects');
        return data.projects || [];
    }

    async setProjects(projects) {
        return await this.setLocalData({ projects });
    }

    // 参照関連（オフライン用キャッシュ）
    async getReferences(projectId = null) {
        const data = await this.getLocalData('references');
        let references = data.references || [];
        
        if (projectId) {
            references = references.filter(ref => ref.projectId === projectId);
        }
        
        return references;
    }

    async setReferences(references) {
        return await this.setLocalData({ references });
    }

    async addReference(reference) {
        const references = await this.getReferences();
        references.push({
            ...reference,
            id: reference.id || this.generateId(),
            createdAt: reference.createdAt || new Date().toISOString(),
            synced: false
        });
        return await this.setReferences(references);
    }

    async updateReference(id, updateData) {
        const references = await this.getReferences();
        const index = references.findIndex(ref => ref.id === id);
        
        if (index !== -1) {
            references[index] = {
                ...references[index],
                ...updateData,
                updatedAt: new Date().toISOString(),
                synced: false
            };
            return await this.setReferences(references);
        }
        
        return false;
    }

    async deleteReference(id) {
        const references = await this.getReferences();
        const filteredReferences = references.filter(ref => ref.id !== id);
        return await this.setReferences(filteredReferences);
    }

    // 選択テキスト関連
    async getSelectedTexts(referenceId = null) {
        const data = await this.getLocalData('selectedTexts');
        let texts = data.selectedTexts || [];
        
        if (referenceId) {
            texts = texts.filter(text => text.referenceId === referenceId);
        }
        
        return texts;
    }

    async setSelectedTexts(texts) {
        return await this.setLocalData({ selectedTexts: texts });
    }

    async addSelectedText(textData) {
        const texts = await this.getSelectedTexts();
        texts.push({
            ...textData,
            id: textData.id || this.generateId(),
            createdAt: textData.createdAt || new Date().toISOString(),
            synced: false
        });
        return await this.setSelectedTexts(texts);
    }

    // ブックマーク関連
    async getBookmarks(referenceId = null) {
        const data = await this.getLocalData('bookmarks');
        let bookmarks = data.bookmarks || [];
        
        if (referenceId) {
            bookmarks = bookmarks.filter(bookmark => bookmark.referenceId === referenceId);
        }
        
        return bookmarks;
    }

    async setBookmarks(bookmarks) {
        return await this.setLocalData({ bookmarks });
    }

    async addBookmark(bookmarkData) {
        const bookmarks = await this.getBookmarks();
        bookmarks.push({
            ...bookmarkData,
            id: bookmarkData.id || this.generateId(),
            createdAt: bookmarkData.createdAt || new Date().toISOString(),
            synced: false
        });
        return await this.setBookmarks(bookmarks);
    }

    // 同期関連
    async getPendingSyncItems() {
        const references = await this.getReferences();
        const texts = await this.getSelectedTexts();
        const bookmarks = await this.getBookmarks();
        
        return {
            references: references.filter(item => !item.synced),
            texts: texts.filter(item => !item.synced),
            bookmarks: bookmarks.filter(item => !item.synced)
        };
    }

    async markAsSynced(type, id) {
        switch (type) {
            case 'reference':
                const references = await this.getReferences();
                const refIndex = references.findIndex(ref => ref.id === id);
                if (refIndex !== -1) {
                    references[refIndex].synced = true;
                    await this.setReferences(references);
                }
                break;
            case 'text':
                const texts = await this.getSelectedTexts();
                const textIndex = texts.findIndex(text => text.id === id);
                if (textIndex !== -1) {
                    texts[textIndex].synced = true;
                    await this.setSelectedTexts(texts);
                }
                break;
            case 'bookmark':
                const bookmarks = await this.getBookmarks();
                const bookmarkIndex = bookmarks.findIndex(bookmark => bookmark.id === id);
                if (bookmarkIndex !== -1) {
                    bookmarks[bookmarkIndex].synced = true;
                    await this.setBookmarks(bookmarks);
                }
                break;
        }
    }

    // 統計情報
    async getStatistics() {
        const references = await this.getReferences();
        const texts = await this.getSelectedTexts();
        const bookmarks = await this.getBookmarks();
        
        return {
            totalReferences: references.length,
            totalTexts: texts.length,
            totalBookmarks: bookmarks.length,
            unsyncedReferences: references.filter(ref => !ref.synced).length,
            unsyncedTexts: texts.filter(text => !text.synced).length,
            unsyncedBookmarks: bookmarks.filter(bookmark => !bookmark.synced).length
        };
    }

    // ユーティリティ
    generateId() {
        return 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async exportData() {
        const data = {
            references: await this.getReferences(),
            texts: await this.getSelectedTexts(),
            bookmarks: await this.getBookmarks(),
            settings: await this.getSettings(),
            exportDate: new Date().toISOString()
        };
        
        return JSON.stringify(data, null, 2);
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.references) await this.setReferences(data.references);
            if (data.texts) await this.setSelectedTexts(data.texts);
            if (data.bookmarks) await this.setBookmarks(data.bookmarks);
            if (data.settings) await this.setSettings(data.settings);
            
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    // データクリーンアップ
    async cleanupOldData(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const references = await this.getReferences();
        const texts = await this.getSelectedTexts();
        const bookmarks = await this.getBookmarks();
        
        const filteredReferences = references.filter(ref => 
            new Date(ref.createdAt) > cutoffDate || !ref.synced
        );
        const filteredTexts = texts.filter(text => 
            new Date(text.createdAt) > cutoffDate || !text.synced
        );
        const filteredBookmarks = bookmarks.filter(bookmark => 
            new Date(bookmark.createdAt) > cutoffDate || !bookmark.synced
        );
        
        await this.setReferences(filteredReferences);
        await this.setSelectedTexts(filteredTexts);
        await this.setBookmarks(filteredBookmarks);
        
        return {
            removedReferences: references.length - filteredReferences.length,
            removedTexts: texts.length - filteredTexts.length,
            removedBookmarks: bookmarks.length - filteredBookmarks.length
        };
    }
}
