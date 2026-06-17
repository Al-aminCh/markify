/**
 * Markify — App Logic
 * Handles file upload, URL conversion, download, copy, and AI sharing.
 */

(function () {
    'use strict';

    // --- API Configuration ---
    // When deploying frontend on Netlify and backend on Render,
    // set this to your Render backend URL, e.g.: 'https://markify-api.onrender.com'
    // For local development, leave as empty string (same origin).
    const API_BASE = 'https://markify-enpq.onrender.com';

    // --- DOM Elements ---
    const themeToggle = document.getElementById('themeToggle');
    const tabFile = document.getElementById('tabFile');
    const tabUrl = document.getElementById('tabUrl');
    const panelFile = document.getElementById('panelFile');
    const panelUrl = document.getElementById('panelUrl');
    const dropzone = document.getElementById('dropzone');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileRemove = document.getElementById('fileRemove');
    const convertFileBtn = document.getElementById('convertFileBtn');
    const urlInput = document.getElementById('urlInput');
    const clearUrlBtn = document.getElementById('clearUrlBtn');
    const convertUrlBtn = document.getElementById('convertUrlBtn');
    const uploadSection = document.getElementById('uploadSection');
    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');
    const errorSection = document.getElementById('errorSection');
    const resultFilename = document.getElementById('resultFilename');
    const resultWarning = document.getElementById('resultWarning');
    const warningText = document.getElementById('warningText');
    const markdownContent = document.getElementById('markdownContent');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const convertAnother = document.getElementById('convertAnother');
    const retryBtn = document.getElementById('retryBtn');
    const errorMessage = document.getElementById('errorMessage');
    const formatsSection = document.getElementById('formatsSection');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // --- State ---
    let selectedFile = null;
    let currentMarkdown = '';
    let currentFilename = '';

    // --- Theme ---
    function initTheme() {
        const saved = localStorage.getItem('markify-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else {
            // Detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('markify-theme', next);
    }

    initTheme();
    themeToggle.addEventListener('click', toggleTheme);

    // --- Tabs ---
    tabFile.addEventListener('click', () => switchTab('file'));
    tabUrl.addEventListener('click', () => switchTab('url'));

    function switchTab(tab) {
        if (tab === 'file') {
            tabFile.classList.add('active');
            tabUrl.classList.remove('active');
            panelFile.classList.add('active');
            panelUrl.classList.remove('active');
        } else {
            tabUrl.classList.add('active');
            tabFile.classList.remove('active');
            panelUrl.classList.add('active');
            panelFile.classList.remove('active');
        }
    }

    // --- File Upload ---
    // Drag & drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedFile) dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    // Click to browse
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        // Validate size (50MB)
        if (file.size > 50 * 1024 * 1024) {
            showToast('File too large. Maximum size is 50MB.');
            return;
        }

        selectedFile = file;

        // Show file preview
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        dropzoneContent.classList.add('hidden');
        filePreview.classList.remove('hidden');
        dropzone.classList.add('has-file');
        convertFileBtn.disabled = false;
    }

    // Remove file
    fileRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFile();
    });

    function clearFile() {
        selectedFile = null;
        fileInput.value = '';
        dropzoneContent.classList.remove('hidden');
        filePreview.classList.add('hidden');
        dropzone.classList.remove('has-file');
        convertFileBtn.disabled = true;
    }

    // --- URL Input ---
    urlInput.addEventListener('input', () => {
        const hasValue = urlInput.value.trim().length > 0;
        convertUrlBtn.disabled = !hasValue;
        if (hasValue) {
            clearUrlBtn.classList.remove('hidden');
        } else {
            clearUrlBtn.classList.add('hidden');
        }
    });

    clearUrlBtn.addEventListener('click', () => {
        urlInput.value = '';
        convertUrlBtn.disabled = true;
        clearUrlBtn.classList.add('hidden');
        urlInput.focus();
    });

    // --- Convert File ---
    convertFileBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        showLoading();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch(`${API_BASE}/api/convert`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Conversion failed');
            }

            showResult(data);
        } catch (err) {
            showError(err.message || 'Something went wrong. Please try again.');
        }
    });

    // --- Convert URL ---
    convertUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        showLoading();

        const formData = new FormData();
        formData.append('url', url);

        try {
            const response = await fetch(`${API_BASE}/api/convert-url`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Conversion failed');
            }

            showResult(data);
        } catch (err) {
            showError(err.message || 'Something went wrong. Please try again.');
        }
    });

    // Allow pressing Enter in the URL field
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !convertUrlBtn.disabled) {
            convertUrlBtn.click();
        }
    });

    // --- UI State Management ---
    function showLoading() {
        uploadSection.classList.add('hidden');
        formatsSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        errorSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
    }

    function showResult(data) {
        loadingSection.classList.add('hidden');

        currentMarkdown = data.markdown || '';
        currentFilename = data.filename || 'converted';

        resultFilename.textContent = currentFilename;
        markdownContent.textContent = currentMarkdown || '(No content extracted)';

        // Show warning if present
        if (data.warning) {
            warningText.textContent = data.warning;
            resultWarning.classList.remove('hidden');
        } else {
            resultWarning.classList.add('hidden');
        }

        resultSection.classList.remove('hidden');

        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showError(message) {
        loadingSection.classList.add('hidden');
        errorMessage.textContent = message;
        errorSection.classList.remove('hidden');
        uploadSection.classList.remove('hidden');
        formatsSection.classList.remove('hidden');
    }

    function resetToUpload() {
        resultSection.classList.add('hidden');
        errorSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        formatsSection.classList.remove('hidden');
        clearFile();
        urlInput.value = '';
        convertUrlBtn.disabled = true;
        clearUrlBtn.classList.add('hidden');
        currentMarkdown = '';
        currentFilename = '';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Convert Another / Retry
    convertAnother.addEventListener('click', resetToUpload);
    retryBtn.addEventListener('click', resetToUpload);

    // --- Copy ---
    copyBtn.addEventListener('click', async () => {
        if (!currentMarkdown) return;

        try {
            await navigator.clipboard.writeText(currentMarkdown);
            // Visual feedback
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            showToast('Failed to copy. Please select and copy manually.');
        }
    });

    // --- Download ---
    downloadBtn.addEventListener('click', () => {
        if (!currentMarkdown) return;

        // Generate filename - keep original name but change extension to .md
        let name = currentFilename;
        const dotIndex = name.lastIndexOf('.');
        if (dotIndex > 0) {
            name = name.substring(0, dotIndex);
        }
        name += '.md';

        const blob = new Blob([currentMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('File downloaded!');
    });

    // --- Share to AI ---
    const platformUrls = {
        chatgpt: 'https://chatgpt.com/',
        gemini: 'https://gemini.google.com/app',
        claude: 'https://claude.ai/new',
        perplexity: 'https://www.perplexity.ai/',
        notebooklm: 'https://notebooklm.google.com/',
    };

    document.querySelectorAll('.share-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const platform = btn.dataset.platform;
            if (!currentMarkdown || !platform) return;

            try {
                await navigator.clipboard.writeText(currentMarkdown);
                showToast(`Markdown copied! Paste it in ${btn.querySelector('span').textContent}.`);
                // Open platform in new tab
                setTimeout(() => {
                    window.open(platformUrls[platform], '_blank', 'noopener,noreferrer');
                }, 300);
            } catch (err) {
                showToast('Failed to copy. Please copy manually, then visit the platform.');
                window.open(platformUrls[platform], '_blank', 'noopener,noreferrer');
            }
        });
    });

    // --- Toast ---
    let toastTimeout = null;

    function showToast(message, duration = 3000) {
        if (toastTimeout) clearTimeout(toastTimeout);

        toastMessage.textContent = message;
        toast.classList.remove('hidden');

        // Force reflow to restart animation
        toast.offsetHeight;
        toast.classList.add('visible');

        toastTimeout = setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, duration);
    }

    // --- Utility ---
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    }

})();
