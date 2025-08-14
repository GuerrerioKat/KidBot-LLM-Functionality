console.log('[KidBot] script loaded');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognizer = SpeechRecognition ? new SpeechRecognition() : null;

if (recognizer) {
  recognizer.lang = 'en-US';
  recognizer.continuous = true;
  recognizer.interimResults = false;   // we only need the final string
  recognizer.maxAlternatives = 1;
} else {
  console.warn('[KidBot] SpeechRecognition not supported in this browser');
}

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('buddy-toggle');
    const popup = document.getElementById('buddy-popup');
    
    // Highlighter cursor setup
    let highlighterCursor = null;
    let isHighlighterMode = false;
    let wasHighlighterActiveBeforeModal = false;
    
    // Cache DOM selectors for performance
    let characterItems = null;
    let accessoryItems = null;
    
    //  ----------------- BEGIN KATHERINE CODE  -----------------
    
    // Chatbot send button for text input
    const btn = document.getElementById('buddy-send');
    if (!btn) return console.error('[Buddy] send button missing');
    btn.addEventListener('click', sendToBuddy);

    // Chatbot mic button for voice input
    const micBtn  = document.getElementById('buddy-mic');
    const inputEl = document.getElementById('buddy-input');
    const out = document.getElementById('buddy-response');

    if (micBtn && recognizer) {
        // micBtn.addEventListener('pointerdown', () => {
        //     recognizer.start();
        //     console.log('[Buddy] recognizer.start()'); // tell me when the recognizer starts
        // });
        // micBtn.addEventListener('pointerup',    () => recognizer.stop());
        // micBtn.addEventListener('pointerleave', () => recognizer.stop());

        try {
            recognizer.start();            // ask for mic permission & start listening
            console.log('[Buddy] recognizer.start() — hands-free mode');
            out.innerText = '🎤 Listening…';
        } catch (err) {
            // Chrome throws InvalidStateError if start is called while already active
            console.warn('[Buddy] recognizer already active', err);
        }

        let lastTranscript = '';

        recognizer.addEventListener('result', ev => {
        const res = ev.results[ev.resultIndex];
        if (!res.isFinal) return;

        const transcript = res[0].transcript.trim();
        if (!transcript || transcript === lastTranscript) return;
        console.log('[Buddy] Transcript:', transcript); // print out the transcript
        if (out) out.innerText = `🗣 You said: "${transcript}"`;

        lastTranscript = transcript;
        inputEl.value  = transcript;
        sendToBuddy();
        });

        recognizer.addEventListener('end', () => {
        console.log('[Buddy] recognizer ended — restarting');
        try { recognizer.start(); } catch (_) { /* ignore double-starts */ }
        });
        
        micBtn.addEventListener('click', () => {
            recognizer.start();
            console.log('[Buddy] recognizer.start()');
            out.innerText = '🎤 Listening…';
        });

        recognizer.addEventListener('speechend', () => {
            console.log('[Buddy] speechend — stopping recognizer');
            recognizer.stop();
        });
        
        //Tell me if there's an error
        recognizer.addEventListener('error', (e) =>
            console.error('[Buddy] recognizer error:', e.error)
        );
    }

    // ----------------- END KATHERINE CODE  -----------------
    
    if (toggleButton && popup) {
        toggleButton.addEventListener('click', function() {
            const isVisible = popup.classList.contains('show');
            
            if (isVisible) {
                // Closing popup
                closePopup();
            } else {
                // Opening popup
                openPopup();
            }
        });
    }
    
    // Function to open popup with backdrop
    function openPopup() {
        if (popup) {
            // Ensure popup is positioned correctly
            positionPopup();
            
            // Add body class for better UX
            document.body.classList.add('buddy-popup-open');
            
            // Create targeted backdrop for book images
            createImageBackdrop();
            
            // Show popup only (no global backdrop)
            popup.classList.add('show');
        }
    }
    
    // Function to create backdrop specifically for book images
    function createImageBackdrop() {
        // Remove any existing backdrops
        const existingBackdrops = document.querySelectorAll('.buddy-image-backdrop');
        existingBackdrops.forEach(backdrop => backdrop.remove());
        
        // Find all book image containers
        const imageContainers = document.querySelectorAll('.page-img');
        
        // Backdrop styles object to avoid repetition
        const backdropStyles = {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            webkitBackdropFilter: 'blur(4px)',
            zIndex: '9998',
            opacity: '0',
            visibility: 'hidden',
            transition: 'all 0.3s ease',
            pointerEvents: 'none'
        };
        
        imageContainers.forEach(container => {
            // Skip if container already has a backdrop
            if (container.querySelector('.buddy-image-backdrop')) {
                return;
            }
            
            // Create backdrop element
            const backdrop = document.createElement('div');
            backdrop.className = 'buddy-popup-backdrop buddy-image-backdrop';
            
            // Apply styles
            Object.assign(backdrop.style, backdropStyles);
            
            // Add to container
            container.style.position = 'relative';
            container.appendChild(backdrop);
            
            // Show the backdrop
            setTimeout(() => {
                backdrop.style.opacity = '1';
                backdrop.style.visibility = 'visible';
            }, 10);
        });
    }
    
    // Function to position popup within viewport bounds
    function positionPopup() {
        if (!popup) return;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const popupRect = popup.getBoundingClientRect();
        
        // Reset any inline styles first
        popup.style.left = '';
        popup.style.top = '';
        popup.style.right = '';
        
        // For mobile devices, center the popup
        if (viewportWidth <= 768) {
            popup.style.left = '20px';
            popup.style.right = '20px';
            popup.style.top = '50%';
            popup.style.transform = 'translateY(-50%)';
        } else {
            // For desktop, position on the left side
            popup.style.left = '25%';
            popup.style.top = '50%';
            popup.style.transform = 'translateY(-50%)';
            
            // Ensure it doesn't go off-screen
            const maxWidth = Math.min(300, viewportWidth - 100);
            popup.style.maxWidth = maxWidth + 'px';
        }
    }
    
    // Function to close popup with backdrop
    function closePopup() {
        if (popup) {
            popup.classList.remove('show');
            
            // Remove body class
            document.body.classList.remove('buddy-popup-open');
            
            // Remove image backdrops
            removeImageBackdrop();
            
            // Clear sentence selection when popup closes
            clearSentenceSelection();
            clearSentenceClickHandlers();
            
            // Cancel any ongoing speech
            if (synth) synth.cancel();
        }
    }
    
    // Function to remove image backdrops
    function removeImageBackdrop() {
        const existingBackdrops = document.querySelectorAll('.buddy-image-backdrop');
        existingBackdrops.forEach(backdrop => {
            backdrop.style.opacity = '0';
            backdrop.style.visibility = 'hidden';
            setTimeout(() => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        });
    }
    
    // Add click event for speaker button and action buttons
    document.addEventListener('click', function(e) {
        if (e.target && e.target.closest('.buddy-speaker-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Simple: check which screen we're on and speak the appropriate text
            const speechBubble = e.target.closest('.buddy-speech-bubble');
            if (speechBubble) {
                const hasBackButton = speechBubble.querySelector('.buddy-back-btn');
                
                if (hasBackButton) {
                    // Help mode - check for sentence or word
                    if (speechBubble.textContent.includes('sentence')) {
                        // BACKEND DEVS: PERSONALIZE THIS MESSAGE WITH USER'S NAME!
                        // speakText(`Hey ${buddyUserData.userName}! Highlight the sentence you need help with.`);
                        speakText("Highlight the sentence that you need help with or use the microphone to speak");
                    } else {
                        speakText("Highlight the word that you need help with or use the microphone to speak");
                    }
                } else {
                    // Main menu - BACKEND DEVS: PERSONALIZE THIS!
                    // speakText(`Hey ${buddyUserData.userName}! I'm Buddy and I'm here to read with you.`);
                    speakText("Hey, I'm Buddy! I am here to read with you. How can I help you?");
                }
            }
        }
        
        // Handle "Help with a sentence" button click
        if (e.target && e.target.classList.contains('buddy-option-btn') && e.target.dataset.action === 'sentence') {
            e.preventDefault();
            e.stopPropagation();
            
            // BACKEND DEVS: TRACK USER INTERACTIONS FOR ANALYTICS?
            // logUserInteraction('sentence_help_clicked', { timestamp: Date.now() });
            
            showSentenceHelp();
        }
        
        // Handle "Help with a word" button click
        if (e.target && e.target.classList.contains('buddy-option-btn') && e.target.dataset.action === 'word') {
            e.preventDefault();
            e.stopPropagation();
            
            // BACKEND DEVS: TRACK USER INTERACTIONS FOR ANALYTICS?
            // logUserInteraction('word_help_clicked', { timestamp: Date.now() });
            
            showWordHelp();
        }
        
        // Handle back button click
        if (e.target && e.target.classList.contains('buddy-back-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            showMainMenu();
        }

        // Handle avatar edit button click
        if (e.target && e.target.closest('.buddy-avatar-edit')) {
            e.preventDefault();
            e.stopPropagation();
            
            // Temporarily disable highlighter mode for avatar customization
            wasHighlighterActiveBeforeModal = isHighlighterMode;
            if (wasHighlighterActiveBeforeModal) {
                disableHighlighterMode();
            }
            
            openAvatarCustomizer();
        }

        // Handle modal close button click
        if (e.target && e.target.classList.contains('buddy-modal-close')) {
            e.preventDefault();
            e.stopPropagation();
            
            closeAvatarCustomizer();
            
            restoreHighlighterMode();
        }

        // Handle done button click
        if (e.target && e.target.classList.contains('buddy-done-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            saveAvatarSelection();
            closeAvatarCustomizer();
            
            restoreHighlighterMode();
        }

        // Handle tab button clicks
        if (e.target && e.target.classList.contains('buddy-tab-btn')) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabName = e.target.dataset.tab;
            if (tabName) {
                switchTab(tabName);
            }
        }

        // Handle backdrop click to close modal
        if (e.target && e.target.classList.contains('buddy-modal-backdrop')) {
            e.preventDefault();
            e.stopPropagation();
            
            closeAvatarCustomizer();
            
            restoreHighlighterMode();
        }

        // Handle popup backdrop click to close popup
        if (e.target && e.target.id === 'buddy-popup-backdrop') {
            e.preventDefault();
            e.stopPropagation();
            
            closePopup();
        }

        // Handle character selection clicks
        if (e.target && e.target.closest('.buddy-character-item')) {
            e.preventDefault();
            e.stopPropagation();
            
            const characterItem = e.target.closest('.buddy-character-item');
            const characterId = characterItem.dataset.character;
            
            if (characterId) {
                selectCharacter(characterId);
            }
        }

        // Handle accessory selection clicks
        if (e.target && e.target.closest('.buddy-accessory-item')) {
            e.preventDefault();
            e.stopPropagation();
            
            const accessoryItem = e.target.closest('.buddy-accessory-item');
            const accessoryId = accessoryItem.dataset.accessory;
            
            if (accessoryId) {
                toggleAccessory(accessoryId);
            }
        }
    });
    
    // Function to show sentence help mode
    function showSentenceHelp() {
        const speechBubble = document.querySelector('.buddy-speech-bubble');
        const optionsContainer = document.querySelector('.buddy-options');
        
        if (speechBubble && optionsContainer) {
            // Update message with back button
            speechBubble.innerHTML = '<button class="buddy-back-btn">←</button>Highlight the sentence that you need help with or use the microphone to speak <button class="buddy-speaker-btn">🔊</button>';
            
            // Hide options
            optionsContainer.style.display = 'none';
        }
        
        // Enable sentence selection mode
        enableSentenceSelection();
    }
    
    // Function to show word help mode
    function showWordHelp() {
        const speechBubble = document.querySelector('.buddy-speech-bubble');
        const optionsContainer = document.querySelector('.buddy-options');
        
        if (speechBubble && optionsContainer) {
            // Update message with back button
            speechBubble.innerHTML = '<button class="buddy-back-btn">←</button>Highlight the word that you need help with or use the microphone to speak <button class="buddy-speaker-btn">🔊</button>';
            
            // Hide options
            optionsContainer.style.display = 'none';
        }
        
        // Enable highlighter mode
        enableHighlighterMode();
    }
    
    // Function to go back to main menu
    function showMainMenu() {
        const speechBubble = document.querySelector('.buddy-speech-bubble');
        const optionsContainer = document.querySelector('.buddy-options');
        
        if (speechBubble && optionsContainer) {
            // Restore original message
            speechBubble.innerHTML = 'Hey, I\'m Buddy! I am here to read with you. How can I help you? <button class="buddy-speaker-btn">🔊</button>';
            
            // Show options
            optionsContainer.style.display = 'flex';
        }
        
        // Clear sentence selection
        clearSentenceSelection();
        clearSentenceClickHandlers();
        
        // Reset mic button
        const micButton = document.querySelector('.buddy-mic-btn');
        if (micButton) {
            micButton.innerHTML = '<img src="' + window.location.origin + '/wp-content/plugins/buddy-companion/images/microphone.png" alt="Microphone" width="24" height="24" />';
            micButton.style.background = '#2196F3';
            micButton.onclick = null;
        }
        
        // Disable highlighter mode
        disableHighlighterMode();
    }
    
    // Function to create highlighter cursor
    function createHighlighterCursor() {
        if (highlighterCursor) return;
        
        highlighterCursor = document.createElement('div');
        highlighterCursor.className = 'buddy-highlighter-cursor';
        highlighterCursor.style.display = 'none';
        document.body.appendChild(highlighterCursor);
    }
    
    // Function to enable highlighter mode
    function enableHighlighterMode() {
        if (isHighlighterMode) return;
        
        isHighlighterMode = true;
        createHighlighterCursor();
        
        // Add body class to hide default cursor
        document.body.classList.add('buddy-highlighter-mode');
        
        // Show highlighter cursor
        if (highlighterCursor) {
            highlighterCursor.style.display = 'block';
        }
    }
    
    // Function to disable highlighter mode
    function disableHighlighterMode() {
        if (!isHighlighterMode) return;
        
        isHighlighterMode = false;
        
        // Remove body class to restore default cursor
        document.body.classList.remove('buddy-highlighter-mode');
        
        // Hide highlighter cursor
        if (highlighterCursor) {
            highlighterCursor.style.display = 'none';
        }
    }
    
    // Function to restore highlighter mode after modal closes
    function restoreHighlighterMode() {
        if (wasHighlighterActiveBeforeModal) {
            enableHighlighterMode();
            wasHighlighterActiveBeforeModal = false;
        }
    }
    
    // Function to update highlighter cursor position
    function updateHighlighterPosition(e) {
        if (!isHighlighterMode || !highlighterCursor) return;
        
        highlighterCursor.style.left = e.clientX + 'px';
        highlighterCursor.style.top = e.clientY + 'px';
    }
    
    // Mouse move event listener for highlighter cursor
    document.addEventListener('mousemove', updateHighlighterPosition);

    // Cached DOM elements for performance
    let cachedElements = {
        speechBubble: null,
        optionsContainer: null,
        micButton: null,
        imageContainers: null,
        existingBackdrops: null
    };

    // Sentence selection variables
    let currentSentenceSelection = null;
    let sentenceClickHandlers = [];

    // Utility function to get cached DOM elements
    function getCachedElement(key, selector) {
        if (!cachedElements[key] || !document.contains(cachedElements[key])) {
            cachedElements[key] = document.querySelector(selector);
        }
        return cachedElements[key];
    }

    // Function to enable sentence selection mode
    function enableSentenceSelection() {
        // Enable highlighter mode for cursor
        enableHighlighterMode();
        
        // Find and make sentences clickable
        makeSentencesClickable();
        
        // Update Buddy interface
        updateBuddyForSentenceSelection();
    }

    // Function to find sentences on current page
    function findSentencesOnPage() {
        // Find all book pages
        const allPages = document.querySelectorAll('.book-page-text .page-copy');
        if (!allPages.length) return [];
        
        // Find the currently visible page (the one that's not hidden)
        let currentPage = null;
        for (let page of allPages) {
            // Check if this page is visible (not hidden by CSS or display:none)
            const rect = page.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && page.offsetParent !== null) {
                currentPage = page;
                break;
            }
        }
        
        // If no visible page found, try the first one
        if (!currentPage && allPages.length > 0) {
            currentPage = allPages[0];
        }
        
        if (!currentPage) return [];
        
        // Get all paragraphs (sentences) from the visible page
        const sentences = currentPage.querySelectorAll('p');
        return Array.from(sentences);
    }

    // Function to make sentences clickable
    function makeSentencesClickable() {
        // Clear any existing handlers
        clearSentenceClickHandlers();
        
        const sentences = findSentencesOnPage();
        
        sentences.forEach(sentence => {
            sentence.classList.add('sentence-clickable');
            
            // Create click handler
            const clickHandler = (event) => handleSentenceClick(event);
            sentence.addEventListener('click', clickHandler);
            
            // Store handler for cleanup
            sentenceClickHandlers.push({ element: sentence, handler: clickHandler });
        });
    }

    // Function to handle sentence click
    function handleSentenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const sentence = event.target;
        
        // Clear previous selection
        clearSentenceSelection();
        
        // Highlight this sentence
        sentence.classList.add('sentence-highlight');
        
        // Store selection data
        currentSentenceSelection = {
            text: sentence.textContent.trim(),
            element: sentence,
            pageId: sentence.closest('.page-copy')?.id || 'unknown',
            timestamp: Date.now()
        };
        
        // Update Buddy interface
        updateBuddyWithSelection(currentSentenceSelection);
    }

    // Function to clear sentence selection
    function clearSentenceSelection() {
        // Remove highlight from all sentences
        const highlightedSentences = document.querySelectorAll('.sentence-highlight');
        highlightedSentences.forEach(sentence => {
            sentence.classList.remove('sentence-highlight');
        });
        
        currentSentenceSelection = null;
    }

    // Function to clear sentence click handlers
    function clearSentenceClickHandlers() {
        sentenceClickHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
            element.classList.remove('sentence-clickable');
        });
        sentenceClickHandlers = [];
    }

    // Function to update Buddy interface for sentence selection
    function updateBuddyForSentenceSelection() {
        const speechBubble = getCachedElement('speechBubble', '.buddy-speech-bubble');
        if (speechBubble) {
            speechBubble.innerHTML = '<button class="buddy-back-btn">←</button>Highlight the sentence that you need help with or use the microphone to speak <button class="buddy-speaker-btn">🔊</button>';
        }
    }

    // Function to update Buddy with selection
    function updateBuddyWithSelection(selectionData) {
        const speechBubble = getCachedElement('speechBubble', '.buddy-speech-bubble');
        if (speechBubble) {
            speechBubble.innerHTML = `
                <button class="buddy-back-btn">←</button>
                Selected: "${selectionData.text}"
                <button class="buddy-speaker-btn">🔊</button>
            `;
        }
        
        // Show process button
        showProcessButton();
    }

    // Function to show process button
    function showProcessButton() {
        const micButton = getCachedElement('micButton', '.buddy-mic-btn');
        if (micButton) {
            micButton.innerHTML = 'Process with AI';
            micButton.style.background = '#4CAF50';
            micButton.onclick = processSelectionWithAI;
        }
    }

    // Function to process selection with AI (placeholder for future backend)
    function processSelectionWithAI() {
        if (!currentSentenceSelection) return;
        
        const speechBubble = document.querySelector('.buddy-speech-bubble');
        if (speechBubble) {
            speechBubble.innerHTML = `
                <button class="buddy-back-btn">←</button>
                Processing: "${currentSentenceSelection.text}"...
                <button class="buddy-speaker-btn">🔊</button>
            `;
        }
        
        // BACKEND DEVS: REPLACE THIS WITH REAL AI API CALL!
        
        // TODO: Send to AI backend
        console.log('Processing selection:', currentSentenceSelection);
        
        // For now, just show a placeholder response
        setTimeout(() => {
            if (speechBubble) {
                speechBubble.innerHTML = `
                    <button class="buddy-back-btn">←</button>
                    I'll help you understand this sentence! (AI backend coming soon)
                    <button class="buddy-speaker-btn">🔊</button>
                `;
            }
        }, 2000);
    }

    // Function to handle page changes (re-initialize sentence selection if needed)
    function handlePageChange() {
        if (isHighlighterMode && currentSentenceSelection) {
            // Re-initialize sentence selection for new page
            setTimeout(() => {
                makeSentencesClickable();
            }, 100);
        }
        
        // Also re-initialize blur backdrops if popup is open
        if (popup && popup.classList.contains('show')) {
            setTimeout(() => {
                createImageBackdrop();
            }, 100);
        }
    }

    // Monitor for DOM changes that might indicate page navigation
    function setupPageChangeMonitoring() {
        // Create a MutationObserver to watch for changes in the book container
        const bookContainer = document.querySelector('#tiplit-turn-main');
        if (bookContainer) {
            const observer = new MutationObserver((mutations) => {
                // Check if any mutations involve page-img elements
                const hasPageChanges = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && (
                            node.classList?.contains('page-img') ||
                            node.querySelector?.('.page-img')
                        )
                    ) || Array.from(mutation.removedNodes).some(node => 
                        node.nodeType === 1 && (
                            node.classList?.contains('page-img') ||
                            node.querySelector?.('.page-img')
                        )
                    );
                });
                
                if (hasPageChanges) {
                    // Page changed, re-initialize if needed
                    setTimeout(() => {
                        handlePageChange();
                    }, 50);
                }
            });
            
            observer.observe(bookContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    // Consolidated page change monitoring
    function checkForPageChanges() {
        // Check sentence selection
        const currentSentences = findSentencesOnPage();
        if (currentSentences.length > 0 && isHighlighterMode) {
            const hasHandlers = sentenceClickHandlers.length > 0;
            const hasClickableSentences = currentSentences.some(s => s.classList.contains('sentence-clickable'));
            
            if (!hasHandlers || !hasClickableSentences) {
                makeSentencesClickable();
            }
        }
        
        // Check blur backdrops
        if (popup && popup.classList.contains('show')) {
            const currentImageContainers = document.querySelectorAll('.page-img');
            const existingBackdrops = document.querySelectorAll('.buddy-image-backdrop');
            
            if (currentImageContainers.length > 0 && existingBackdrops.length !== currentImageContainers.length) {
                createImageBackdrop();
            }
        }
    }

    // Single interval for all monitoring
    setInterval(checkForPageChanges, 1000);

    // Keyboard event listener for modal and popup
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close avatar customization modal if open
            const modal = document.getElementById('buddy-avatar-modal');
            if (modal && modal.style.display === 'flex') {
                closeAvatarCustomizer();
                restoreHighlighterMode();
                return;
            }
            
            // Close popup if open
            if (popupBackdrop && popupBackdrop.classList.contains('show')) {
                closePopup();
            }
        }
    });

    // Avatar customization data
    const avatarData = {
        characters: {
            'sun': { id: 'sun', name: 'Sunny', emoji: '☀️' },
            'koala': { id: 'koala', name: 'Koala', emoji: '🐨' },
            'penguin': { id: 'penguin', name: 'Penguin', emoji: '🐧' },
            'bird': { id: 'bird', name: 'Bird', emoji: '🐦' },
            'bear': { id: 'bear', name: 'Bear', emoji: '🐻' },
            'fox': { id: 'fox', name: 'Fox', emoji: '🦊' },
            'dog': { id: 'dog', name: 'Dog', emoji: '🐕' },
            'cat': { id: 'cat', name: 'Cat', emoji: '🐱' },
            'monkey': { id: 'monkey', name: 'Monkey', emoji: '🐵' }
        },
        accessories: {
            'hat_blue': { id: 'hat_blue', name: 'Blue Hat', emoji: '🧢', category: 'head' },
            'glasses': { id: 'glasses', name: 'Glasses', emoji: '👓', category: 'face' },
            'crown': { id: 'crown', name: 'Crown', emoji: '👑', category: 'head' },
            'bowtie': { id: 'bowtie', name: 'Bow Tie', emoji: '🎀', category: 'neck' },
            'headband': { id: 'headband', name: 'Headband', emoji: '👒', category: 'head' },
            'scarf': { id: 'scarf', name: 'Scarf', emoji: '🧣', category: 'neck' },
            'earrings': { id: 'earrings', name: 'Earrings', emoji: '💎', category: 'ears' },
            'mask': { id: 'mask', name: 'Mask', emoji: '🎭', category: 'face' },
            'flower': { id: 'flower', name: 'Flower', emoji: '🌸', category: 'head' }
        },
        selectedCharacter: 'sun', // default selection
        selectedAccessories: [] // can have multiple accessories
    };

    // Pre-generated modal content (cached for performance)
    let modalContentHTML = null;

    // Pre-generate modal content for performance
    function preGenerateModalContent() {
        if (modalContentHTML) return; // Already generated
        
        // Build character grid HTML using efficient array join
        const characterGridParts = Object.values(avatarData.characters).map(character => 
            `<div class="buddy-character-item buddy-item-base buddy-transition buddy-hover-scale" data-character="${character.id}">
                <div class="buddy-character-emoji">${character.emoji}</div>
                <div class="buddy-character-name">${character.name}</div>
            </div>`
        );
        const characterGridHTML = characterGridParts.join('');
        
        // Build accessory grid HTML using efficient array join
        const accessoryGridParts = Object.values(avatarData.accessories).map(accessory => 
            `<div class="buddy-accessory-item buddy-item-base buddy-transition buddy-hover-scale" data-accessory="${accessory.id}">
                <div class="buddy-accessory-emoji">${accessory.emoji}</div>
                <div class="buddy-accessory-name">${accessory.name}</div>
            </div>`
        );
        const accessoryGridHTML = accessoryGridParts.join('');
        
        // Cache the complete modal HTML
        modalContentHTML = `
            <div class="buddy-modal-container">
                <div class="buddy-modal-header">
                    <button class="buddy-modal-close">×</button>
                </div>
                
                <div class="buddy-avatar-preview">
                    <div class="buddy-preview-avatar">
                        <img class="buddy-preview-img" src="" alt="Preview Avatar" width="80" height="80" />
                    </div>
                </div>
                
                <div class="buddy-tab-container">
                    <button class="buddy-tab-btn active" data-tab="character">Character</button>
                    <button class="buddy-tab-btn" data-tab="accessory">Accessory</button>
                </div>
                
                <div class="buddy-tab-content">
                    <div id="buddy-character-tab" class="buddy-tab-pane active">
                        <div class="buddy-character-grid buddy-grid-3">
                            ${characterGridHTML}
                        </div>
                    </div>
                    
                    <div id="buddy-accessory-tab" class="buddy-tab-pane">
                        <div class="buddy-accessory-grid buddy-grid-3">
                            ${accessoryGridHTML}
                        </div>
                    </div>
                </div>
                
                <div class="buddy-modal-footer">
                    <button class="buddy-done-btn">Done</button>
                </div>
            </div>
        `;
        
    }

    function openAvatarCustomizer() {
        
        const modal = document.getElementById('buddy-avatar-modal');
        if (!modal) return;
        
        // Prevent multiple simultaneous opens
        if (modal.style.display === 'flex') return;
        
        // Ensure modal content is generated (fallback if not pre-generated)
        if (!modalContentHTML) {
            preGenerateModalContent();
        }
        
        // Fast insertion of cached content
        modal.innerHTML = modalContentHTML;
        
        // Invalidate cached selectors since DOM changed
        characterItems = null;
        accessoryItems = null;
        
        // Show modal immediately
        requestAnimationFrame(() => {
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            
            // Defer heavy initialization to next frame
            requestAnimationFrame(() => {
                updatePreview();
                syncCharacterSelection();
                syncAccessorySelection();
            });
        });
    }

    function closeAvatarCustomizer() {
        
        const modal = document.getElementById('buddy-avatar-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 200);
        }
    }

    function switchTab(tabName) {
        
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.buddy-tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Update tab panes
        const tabPanes = document.querySelectorAll('.buddy-tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
        });
        
        const activePane = document.getElementById(`buddy-${tabName}-tab`);
        if (activePane) {
            activePane.classList.add('active');
        }
    }

    function selectCharacter(characterId) {
        
        // Update data
        avatarData.selectedCharacter = characterId;
        
        // Cache and update UI - remove selection from all items
        if (!characterItems) {
            characterItems = document.querySelectorAll('.buddy-character-item');
        }
        characterItems.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        const selectedItem = document.querySelector(`[data-character="${characterId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        updatePreview();
    }

    function updatePreview() {
        
        const previewContainer = document.querySelector('.buddy-preview-avatar');
        const selectedChar = avatarData.characters[avatarData.selectedCharacter];
        
        if (previewContainer && selectedChar) {
            // Clear all existing preview content
            previewContainer.innerHTML = '';
            
            // Create new preview display using the same function as main avatars
            const previewDisplay = createAvatarDisplay(selectedChar, avatarData.selectedAccessories, 48);
            previewDisplay.style.cssText += `
                background: linear-gradient(135deg, #f0f8ff 0%, #e3f2fd 100%);
                border-radius: 50%;
                width: 80px;
                height: 80px;
            `;
            
            previewContainer.appendChild(previewDisplay);
        }
    }

    function saveAvatarSelection() {
        
        //(Vanessa) Use REST API to save an avatar 
        //Sends a POST request to the REST API
        fetch(buddyUserData.apiUrl + 'avatar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': buddyUserData.nonce
            },
            body: JSON.stringify({
                //Sends the character/accessories 
                character: avatarData.selectedCharacter,
                accessories: avatarData.selectedAccessories
            })
        })
        .then(res => res.json())
        .then(data => {
            console.log('Avatar saved:', data);
            updateMainAvatars();
        })
        .catch(err => console.error('Failed to save avatar:', err));

        
        // Save to localStorage for persistence
        //localStorage.setItem('buddy_avatar_data', JSON.stringify(avatarData));
    
        // Update main avatars
        updateMainAvatars();
    }

    function updateMainAvatars() {
        const selectedChar = avatarData.characters[avatarData.selectedCharacter];
        if (!selectedChar) return;
        
        
        // Update floating button avatar
        const floatingAvatarContainer = document.querySelector('.buddy-toggle-avatar');
        if (floatingAvatarContainer) {
            // Clear all existing avatar content (img and emoji displays)
            const existingContent = floatingAvatarContainer.querySelector('img, .buddy-avatar-emoji-display');
            if (existingContent) {
                const avatarContainer = createAvatarDisplay(selectedChar, avatarData.selectedAccessories, 40);
                avatarContainer.style.cssText += `
                    background: linear-gradient(135deg, #f0f8ff 0%, #e3f2fd 100%);
                    border-radius: 50%;
                    width: 100%;
                    height: 100%;
                `;
                
                floatingAvatarContainer.replaceChild(avatarContainer, existingContent);
            }
        }
        
        // Update popup avatar
        const popupAvatarContainer = document.querySelector('.buddy-avatar');
        if (popupAvatarContainer) {
            // Clear all existing avatar content (img and emoji displays)
            const existingContent = popupAvatarContainer.querySelector('img, .buddy-avatar-emoji-display');
            if (existingContent) {
                const avatarContainer = createAvatarDisplay(selectedChar, avatarData.selectedAccessories, 60);
                avatarContainer.style.cssText += `
                    background: linear-gradient(135deg, #f0f8ff 0%, #e3f2fd 100%);
                    border-radius: 50%;
                    width: 80px;
                    height: 80px;
                `;
                
                popupAvatarContainer.replaceChild(avatarContainer, existingContent);
            }
        }
    }

    function createAvatarDisplay(character, accessories, charSize) {
        const container = document.createElement('div');
        container.className = 'buddy-avatar-emoji-display';
        container.style.cssText = `
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
        `;
        
        // Add character
        const characterDiv = document.createElement('div');
        characterDiv.textContent = character.emoji;
        characterDiv.style.cssText = `
            font-size: ${charSize}px;
            position: absolute;
            z-index: 1;
        `;
        container.appendChild(characterDiv);
        
        // Add accessories with consistent positioning
        const accessoryPositions = [
            { top: -8, left: 8 },   // Top right
            { top: 8, left: -8 },   // Top left  
            { top: -8, left: -8 },  // Top left
            { top: 8, left: 8 },    // Bottom right
            { top: 0, left: -12 },  // Left center
            { top: 0, left: 12 },   // Right center
            { top: -12, left: 0 },  // Top center
            { top: 12, left: 0 },   // Bottom center
            { top: -6, left: 6 }    // Diagonal
        ];
        
        accessories.forEach((accessoryId, index) => {
            const accessory = avatarData.accessories[accessoryId];
            if (accessory) {
                const position = accessoryPositions[index % accessoryPositions.length];
                const accessoryDiv = document.createElement('div');
                accessoryDiv.textContent = accessory.emoji;
                accessoryDiv.style.cssText = `
                    font-size: ${Math.floor(charSize * 0.4)}px;
                    position: absolute;
                    z-index: ${2 + index};
                    top: ${position.top}px;
                    left: ${position.left}px;
                `;
                container.appendChild(accessoryDiv);
            }
        });
        
        return container;
    }

    function loadAvatarData() {
        
        //(Vanessa) Load avatar using REST API call
        fetch(buddyUserData.apiUrl + 'avatar', {
            //Sends a GET request to the REST API
            method: 'GET',
            headers: {
                'X-WP-Nonce': buddyUserData.nonce
            }
        })
        .then(response => response.json())
        .then(data => {
            //Updates the avatar data 
            avatarData.selectedCharacter = data.character || 'sun';
            avatarData.selectedAccessories = data.accessories || [];
            updateMainAvatars();
        })
        .catch(error => {
            console.error('Failed to load avatar from API:', error);
        });


        
        // Load from localStorage
        //const savedData = localStorage.getItem('buddy_avatar_data');
        //if (savedData) {
            //try {
                //const parsedData = JSON.parse(savedData);
                // Merge with default data to ensure we have all properties
                //avatarData.selectedCharacter = parsedData.selectedCharacter || 'sun';
                //avatarData.selectedAccessories = parsedData.selectedAccessories || [];
                
                
                // Update avatars on page load
                //updateMainAvatars();
            //} catch (error) {
                //console.error('Error loading avatar data:', error);
            //}
        //}
    }

    function toggleAccessory(accessoryId) {
        
        // Check if accessory is already selected
        const index = avatarData.selectedAccessories.indexOf(accessoryId);
        
        if (index > -1) {
            // Remove from selection
            avatarData.selectedAccessories.splice(index, 1);
        } else {
            // Add to selection
            avatarData.selectedAccessories.push(accessoryId);
        }
        
        
        // Update UI
        const accessoryItem = document.querySelector(`[data-accessory="${accessoryId}"]`);
        if (accessoryItem) {
            accessoryItem.classList.toggle('active');
        }
        
        // Update preview
        updatePreview();
    }

    function syncCharacterSelection() {
        
        // Cache and remove selection from all items
        if (!characterItems) {
            characterItems = document.querySelectorAll('.buddy-character-item');
        }
        characterItems.forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to current character
        const selectedItem = document.querySelector(`[data-character="${avatarData.selectedCharacter}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
    }

    function syncAccessorySelection() {
        
        // Cache and remove active state from all items
        if (!accessoryItems) {
            accessoryItems = document.querySelectorAll('.buddy-accessory-item');
        }
        accessoryItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active state to selected accessories
        avatarData.selectedAccessories.forEach(accessoryId => {
            const accessoryItem = document.querySelector(`[data-accessory="${accessoryId}"]`);
            if (accessoryItem) {
                accessoryItem.classList.add('active');
            }
        });
    }

    // Initialize avatar data loading and pre-generate modal content
    loadAvatarData();
    preGenerateModalContent();
    
    // Setup page change monitoring
    setupPageChangeMonitoring();
    
    // Handle window resize for responsive popup positioning
    window.addEventListener('resize', function() {
        if (popup && popup.classList.contains('show')) {
            positionPopup();
        }
    });
    
    // Handle escape key to close popup
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup && popup.classList.contains('show')) {
            closePopup();
        }
    });
    
    // Handle image backdrop clicks to close popup
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('buddy-image-backdrop')) {
            closePopup();
        }
    });
});

async function sendToBuddy() {
  console.log('[Buddy] sendToBuddy() start');
  
  async function speak(text) {
    const apiKey = buddyUserData.elevenLabsApiKey || 'Not Found';
    const voiceId = '21m00Tcm4TlvDq8ikWAM';

    // --- ADD THIS LINE ---
    console.log('[Buddy] ElevenLabs API Key (first few chars):', apiKey ? apiKey.substring(0, 5) + '...' : 'Not found');
    // --- END ADDITION ---


    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        })
    });

    if (!response.ok) {
        console.error("ElevenLabs TTS failed");
        return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
 }


  const inputEl = document.getElementById('buddy-input');
  if (!inputEl) return console.error('[Buddy] input not found');
  const question = inputEl.value.trim();
  console.log('[Buddy] Question:', question);

  const out = document.getElementById('buddy-response');
  out.innerText = '⏳ Thinking…';

  try {
    const resp = await fetch(buddyUserData.ajaxUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action:   'buddy_ask',
        question: question,
        post_id:  buddyUserData.postId
      })
    });
    console.log('[Buddy] fetch status', resp.status);
    const data = await resp.json();
    console.log('[Buddy] parsed JSON:', data);

    if (!data.success) {
      console.warn('[Buddy] server error:', data.data);
      out.innerText = data.data.message || 'Server error';
      return;
    }

    out.innerText = data.data.reply;
    console.log('[Buddy] Final answer:', data.data.reply);
    speak(data.data.reply);
  } catch (err) {
    console.error('[Buddy] network or parse error:', err);
    out.innerText = 'Network error – see console';
  }
}