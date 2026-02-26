// media/main.js

(function () {
    const vscode = acquireVsCodeApi();

    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const caseToggle = document.getElementById('case-sensitive-toggle');
    const regexToggle = document.getElementById('regex-toggle');
    const includeFilesCheckbox = document.getElementById('include-files');
    const includeFoldersCheckbox = document.getElementById('include-folders');

    let searchTimeout;
    let isCaseSensitive = false;
    let useRegex = false;

    function triggerSearch() {
        // Debounce search to avoid excessive API calls
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value;
            vscode.postMessage({
                type: 'search',
                value: query,
                caseSensitive: isCaseSensitive,
                useRegex: useRegex,
                includeFiles: includeFilesCheckbox.checked,
                includeFolders: includeFoldersCheckbox.checked
            });
        }, 10); // Reduced delay for more responsive feel
    }

    searchInput.addEventListener('input', triggerSearch);

    caseToggle.addEventListener('click', () => {
        isCaseSensitive = !isCaseSensitive;
        caseToggle.classList.toggle('active', isCaseSensitive);
        triggerSearch(); // Re-run search with new setting
    });
    
    regexToggle.addEventListener('click', () => {
        useRegex = !useRegex;
        regexToggle.classList.toggle('active', useRegex);
        triggerSearch(); // Re-run search with new setting
    });

    includeFilesCheckbox.addEventListener('change', triggerSearch);
    includeFoldersCheckbox.addEventListener('change', triggerSearch);

    function clearClickedState() {
        const currentlyClicked = document.querySelector('.result-item.clicked');
        if (currentlyClicked) {
            currentlyClicked.classList.remove('clicked');
        }
    }

    function openFile(uri, rowElement) {
        clearClickedState();
        rowElement.classList.add('clicked');
        vscode.postMessage({
            type: 'openFile',
            uri
        });
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'results':
                resultsContainer.innerHTML = ''; // Clear previous results
                if (!message.results || message.results.length === 0) {
                    return;
                }

                message.results.forEach(result => {
                    if (result.type === 'folder') {
                        const item = document.createElement('div');
                        item.className = 'result-item folder-item';

                        const header = document.createElement('div');
                        header.className = 'folder-header';

                        const caret = document.createElement('span');
                        caret.className = 'folder-caret';
                        caret.textContent = '▸';

                        const labelWrap = document.createElement('div');

                        const label = document.createElement('div');
                        label.className = 'result-label';
                        label.textContent = result.label;

                        const description = document.createElement('div');
                        description.className = 'result-description';
                        description.textContent = result.description;

                        labelWrap.appendChild(label);
                        labelWrap.appendChild(description);
                        header.appendChild(caret);
                        header.appendChild(labelWrap);

                        const children = document.createElement('div');
                        children.className = 'folder-children';

                        (result.children || []).forEach(child => {
                            const childItem = document.createElement('div');
                            childItem.className = 'folder-child-item';

                            const childLabel = document.createElement('div');
                            childLabel.className = 'result-label';
                            childLabel.textContent = child.label;

                            const childDescription = document.createElement('div');
                            childDescription.className = 'result-description';
                            childDescription.textContent = child.description;

                            childItem.appendChild(childLabel);
                            childItem.appendChild(childDescription);

                            if (child.type === 'file' && child.uri) {
                                childItem.classList.add('file-child');
                                childItem.addEventListener('click', (event) => {
                                    event.stopPropagation();
                                    openFile(child.uri, childItem);
                                });
                            } else {
                                childItem.classList.add('folder-child');
                            }

                            children.appendChild(childItem);
                        });

                        header.addEventListener('click', () => {
                            const isExpanded = item.classList.toggle('expanded');
                            caret.textContent = isExpanded ? '▾' : '▸';
                        });

                        item.appendChild(header);
                        item.appendChild(children);
                        resultsContainer.appendChild(item);
                        return;
                    }

                    const item = document.createElement('div');
                    item.className = 'result-item';

                    const label = document.createElement('div');
                    label.className = 'result-label';
                    label.textContent = result.label;

                    const description = document.createElement('div');
                    description.className = 'result-description';
                    description.textContent = result.description;

                    item.appendChild(label);
                    item.appendChild(description);

                    item.addEventListener('click', () => {
                        openFile(result.uri, item);
                    });

                    resultsContainer.appendChild(item);
                });
                break;
        }
    });

}());