// src/FileSearchViewProvider.ts

import * as vscode from 'vscode';
import * as path from 'path';

export class FileSearchViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'search-files.file-searcher.view'; // Must match the ID in package.json

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'search':
                    {
                        if (!data.value) {
                            webviewView.webview.postMessage({ type: 'results', results: [] });
                            return;
                        }
                        const includeFiles = data.includeFiles !== false;
                        const includeFolders = data.includeFolders !== false;

                        const matcher = createNameMatcher(data.value, !!data.useRegex, !!data.caseSensitive);
                        if (!matcher) {
                            webviewView.webview.postMessage({ type: 'results', results: [] });
                            return;
                        }

                        const allFiles = await vscode.workspace.findFiles('**/*');
                        const fileEntries = allFiles.map(file => {
                            const description = vscode.workspace.asRelativePath(file);
                            const normalizedDescription = normalizeRelativePath(description);
                            return {
                                type: 'file',
                                uri: file.toString(),
                                label: path.basename(file.fsPath),
                                description,
                                relativePath: normalizedDescription,
                                parentPath: getParentPath(normalizedDescription)
                            };
                        });

                        const folderEntriesByPath = new Map<string, { type: 'folder'; label: string; description: string; relativePath: string; children: Array<{ type: 'file' | 'folder'; label: string; description: string; uri?: string }> }>();

                        for (const fileEntry of fileEntries) {
                            const parts = fileEntry.relativePath.split('/').filter(Boolean);
                            for (let i = 0; i < parts.length - 1; i++) {
                                const relativePath = parts.slice(0, i + 1).join('/');
                                if (!folderEntriesByPath.has(relativePath)) {
                                    folderEntriesByPath.set(relativePath, {
                                        type: 'folder',
                                        label: parts[i],
                                        description: relativePath,
                                        relativePath,
                                        children: []
                                    });
                                }
                            }
                        }

                        for (const folder of folderEntriesByPath.values()) {
                            const childFolders = Array.from(folderEntriesByPath.values())
                                .filter(candidate => getParentPath(candidate.relativePath) === folder.relativePath)
                                .map(candidate => ({
                                    type: 'folder' as const,
                                    label: candidate.label,
                                    description: candidate.description
                                }));

                            const childFiles = fileEntries
                                .filter(fileEntry => fileEntry.parentPath === folder.relativePath)
                                .map(fileEntry => ({
                                    type: 'file' as const,
                                    label: fileEntry.label,
                                    description: fileEntry.description,
                                    uri: fileEntry.uri
                                }));

                            folder.children = [...childFolders, ...childFiles].sort((a, b) => a.label.localeCompare(b.label));
                        }

                        const fileResults = includeFiles
                            ? fileEntries.filter(fileEntry => matcher(fileEntry.label)).map(fileEntry => ({
                                type: 'file',
                                uri: fileEntry.uri,
                                label: fileEntry.label,
                                description: fileEntry.description
                            }))
                            : [];

                        const folderResults = includeFolders
                            ? Array.from(folderEntriesByPath.values())
                                .filter(folder => matcher(folder.label))
                                .map(folder => ({
                                    type: 'folder',
                                    label: folder.label,
                                    description: folder.description,
                                    children: folder.children
                                }))
                            : [];

                        const searchResults = [...folderResults, ...fileResults].sort((a, b) => {
                            if (a.label === b.label) {
                                return a.description.localeCompare(b.description);
                            }
                            return a.label.localeCompare(b.label);
                        });
                        
                        webviewView.webview.postMessage({ type: 'results', results: searchResults });
                        break;
                    }
                case 'openFile':
                    {
                        const uri = vscode.Uri.parse(data.uri);
                        vscode.workspace.openTextDocument(uri).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                        break;
                    }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <title>File Name Search</title>
            </head>
            <body>
                <div id="search-container">
                    <input type="text" id="search-input" placeholder="Enter file name to search...">
                    <div class="search-controls">
                        <div class="control-button" id="case-sensitive-toggle" title="Match Case">Aa</div>
                        <div class="control-button" id="regex-toggle" title="Use Regular Expression">.*</div>
                    </div>
                </div>

                <div id="filter-options">
                    <label class="checkbox-option">
                        <input type="checkbox" id="include-files" checked>
                        <span>Files</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" id="include-folders" checked>
                        <span>Folders</span>
                    </label>
                </div>

                <div id="results-container"></div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function createNameMatcher(searchTerm: string, useRegex: boolean, caseSensitive: boolean): ((name: string) => boolean) | undefined {
    if (useRegex) {
        try {
            const regex = new RegExp(searchTerm, caseSensitive ? '' : 'i');
            return (name: string) => regex.test(name);
        } catch {
            return undefined;
        }
    }

    if (caseSensitive) {
        return (name: string) => name.includes(searchTerm);
    }

    const lowered = searchTerm.toLowerCase();
    return (name: string) => name.toLowerCase().includes(lowered);
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/');
}

function getParentPath(relativePath: string): string {
    const index = relativePath.lastIndexOf('/');
    return index === -1 ? '' : relativePath.slice(0, index);
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}