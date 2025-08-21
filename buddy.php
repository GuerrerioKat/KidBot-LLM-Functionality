<?php
/*
Plugin Name: Buddy Companion
Description: Adds an AI-powered reading assistant popup to book pages.
Version: 1.0
Author: Justin Chen
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Enqueue CSS and JS
function buddy_enqueue_assets() {
    //Checks if the user is logged in 
    wp_enqueue_style('buddy-style', plugin_dir_url(__FILE__) . 'buddy.css', [], '1.0');
    wp_enqueue_script('buddy-script', plugin_dir_url(__FILE__) . 'buddy.js', [], '1.0', true);

    //(Vanessa) Pass user data to JavaScript 
    wp_localize_script('buddy-script', 'buddyUserData', array(
    'userId' => get_current_user_id(),
    'userName' => wp_get_current_user()->display_name,
    'apiUrl' => rest_url('buddy/v1/'),
    'nonce' => wp_create_nonce('wp_rest'),  // use default 'wp_rest' nonce
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'postId'  => get_the_ID() ?: 0,
    'openaiApiKey' => defined('KIDBOT_OPENAI_API_KEY') ? KIDBOT_OPENAI_API_KEY : '',
    'elevenLabsApiKey' => defined('ELEVENLABS_API_KEY') ? ELEVENLABS_API_KEY : ''
));

}
add_action('wp_enqueue_scripts', 'buddy_enqueue_assets');

// The real AJAX handler
add_action('wp_ajax_buddy_ask',      'buddy_ask');
add_action('wp_ajax_nopriv_buddy_ask','buddy_ask');

add_action( 'init', function () { if ( ! session_id() ) session_start(); } );
function buddy_ask() {
  error_log('[Buddy] ask() start.');

  // 3a) Gather + validate inputs
  $question = isset($_POST['question']) ? sanitize_text_field($_POST['question']) : '';
  $post_id  = isset($_POST['post_id'])  ? intval($_POST['post_id'])        : 0;
  if (!$question) {
    error_log('[Buddy] No question provided.');
    wp_send_json_error(['message'=>'Please ask a question first.']);
  }
  if (!$post_id) {
    error_log('[Buddy] No post_id provided.');
    wp_send_json_error(['message'=>'Invalid post.']);
  }

  // Fetch the book content
  $post = get_post($post_id);
  if (!$post) {
    error_log("[Buddy] get_post($post_id) failed.");
    wp_send_json_error(['message'=>'Book content not found.']);
  }

  // Build the prompt
  $prompt = "You are an AI reading companion for teens and tweens with special needs. Your primary goal is to encourage them to enjoy the stories they’re reading and ensure they understand the story. There are six main ways you can interact with the user:
1.	Vocabulary Clarification: a student may be confused about a word on the page that is impairing their ability to understand the story. This word may be pronounced in correctly. In this setting, your task has 3 steps: (1) identify the word that the user is confused about based on the text on the page the user is reading, (2) Explain the definition of the word, and (3) Provide additional clarifying context to the user about what that word means in the context it exists in the story
2.	Comprehension: a student may be confused about what is happening in the story at a particular moment. In this setting, your task has 2 steps: (1) Review the previous content of the story to gain a fundamental understanding of what is happening, and (2) Answer the clarifying question the user asked, placing the most weight on where the student is in the story. Under no circumstances are you to reveal anything about what will happen next in the story. If the user asks about what will happen next or they ask a question that cannot be answered based on previous context (Ex. The user asking who killed the main character in a murder mystery before it’s been revealed), you are not allowed to answer that question. Instead, encourage the student to think about what they think the answer might be and ask questions based on past context in the book. If the student persists, the only response you are allowed to give is that you don’t know, but we can keep reading to find out. You are not allowed to guess based on past information or confirm/deny any of the user’s guesses.
3.	Assessment Assistance: You are not allowed under any circumstances to tell the user the answer to any assessment questions. Instead, encourage the student to think about what they think the answer might be and ask them questions based on past context in the book to help them think through their answer. If the student persists, the only response you are allowed to give is that you don’t know, but they can go back through the book and reread to see if you can help them figure it out. Encourage them to talk through their answer during this reread. You are not allowed to guess based on past information or confirm/deny any of the user’s guesses.
4.	Responding to Comments: Sometimes, a student may not have a question but instead state a comment. Some kinds of comments you may receive include: (1) expressing frustration over a difficult comprehension question, (2) expressing an emotional connection to what’s happening in the story, or (3) XXXXX. In these cases, your task is to respond appropriately in an empathetic, encouraging manner. For example, when expressing frustration over a difficult question, reassure the student that they can do this and encourage them to try again. Another example is if the student mentions an emotional connection, such as “I know how the main character feels; I’ve been bullied to,” you should validate the user’s experiences and emotions and encourage their connection with the story. You may ask follow up questions contrasting/comparing the user’s personal experience with the story, but you should focus on keeping them engaged in the story and validating their emotional experiences.
5.	System Help: A student may be confused about how to use the Readeezy software. If they ask a question about how to open, purchase, or save progress in a book, you should access the system help information provided and help walk the user through their problem to the best of your ability. If you are unable to help them, you should direct them to XXX.
";

  // Your API key
  if ( defined('KIDBOT_OPENAI_API_KEY') && KIDBOT_OPENAI_API_KEY ) {
    $api_key = KIDBOT_OPENAI_API_KEY;
  } else {
    error_log('[Buddy] API key not set.');
    wp_send_json_error(['message'=>'Chatbot not configured.']);
  }

  $messages = $_SESSION['buddy_history'] ?? [
        ['role' => 'system', 'content' => $prompt],
        ['role' => 'system', 'content' => "Book text:\n" . $book_content],
    ];
  
  $messages[] = ['role' => 'user', 'content' => $question];
  // Call OpenAI
  $args = [
    'headers' => [
      'Authorization' => 'Bearer ' . $api_key,
      'Content-Type'  => 'application/json',
    ],
    'body'    => wp_json_encode([
      'model'       => 'gpt-4o-mini',
      'messages'    => $messages,
      'temperature' => 0.7,
    ]),
    'timeout' => 20,
  ];
  $resp = wp_remote_post('https://api.openai.com/v1/chat/completions', $args);
  if ( is_wp_error($resp) ) {
    $err = $resp->get_error_message();
    error_log("[Buddy] wp_remote_post error: $err");
    wp_send_json_error(['message'=>"Request failed: $err"]);
  }

  $raw = wp_remote_retrieve_body($resp);
  error_log("[Buddy] OpenAI raw response: $raw");
  $body = json_decode($raw, true);
  if (!$body || !isset($body['choices'][0]['message']['content'])) {
    error_log('[Buddy] JSON parse failed or missing content.');
    wp_send_json_error(['message'=>'Bad response from OpenAI.']);
  }

  $reply = trim($body['choices'][0]['message']['content']);
  if ($reply === '') {
    error_log('[Buddy] Empty reply.');
    wp_send_json_error(['message'=>'No reply generated.']);
  }
  $messages[] = ['role' => 'assistant', 'content' => $reply];
  $_SESSION['buddy_history'] = $messages;

  // Success!
  error_log("[Buddy] Reply: $reply");
  wp_send_json_success(['reply'=>$reply]);
}

// Shortcode: just the markup
add_shortcode('buddy_chat', 'buddy_render_markup');
function buddy_render_markup() {
  return '
        <div id="buddy">
        <textarea id="buddy-input"
                placeholder="Ask a question about the book…"></textarea>

        <div style="margin-top:.5em;">
        <button id="buddy-mic"   title="Hold to speak">🎤</button>
        <button id="buddy-send">Send</button>

        <label style="margin-left:.5em;">
            <input type="checkbox" id="buddy-tts" checked>
            Read the answer aloud
        </label>
        </div>

        <div id="buddy-response" style="margin-top:.5em;"></div>
    </div>
  ';
}


// JavaScript fallback injection for problematic templates
function buddy_inject_js_fallback() {
    //(Vanessa) Load the user's saved avatar from the database
    $user_id = get_current_user_id();
    $character = get_user_meta($user_id, 'buddy_avatar_character', true) ?: '🙂';
    $accessories = get_user_meta($user_id, 'buddy_avatar_accessories', true) ?: '';
    $avatar_html = '<div class="buddy-avatar-emoji-display">' . esc_html($character);
    if (!empty($accessories)) {
        $avatar_html .= ' ' . esc_html($accessories);
    }
    $avatar_html .= '</div>';

    $avatar_url = plugin_dir_url(__FILE__) . 'images/profile.png';
    $microphone_url = plugin_dir_url(__FILE__) . 'images/microphone.png';
    
    // Only inject if we haven't output HTML yet
    static $js_fallback_done = false;
    if ($js_fallback_done) return;
    $js_fallback_done = true;
    
    echo '<script type="text/javascript">
        // Buddy Companion JavaScript Fallback Injection
        document.addEventListener("DOMContentLoaded", function() {
            // Check if Buddy is already present
            if (document.getElementById("buddy-root")) {
                return; // Already exists, no need to inject
            }
            
            // Create and inject Buddy HTML
            var buddyHTML = `<div id="buddy-root">
                <button id="buddy-toggle">
                    <div class="buddy-toggle-avatar">
                        <img src="' . esc_url($avatar_url) . '" alt="Buddy Avatar" width="60" height="60" style="border-radius: 50%;" />
                        <button class="buddy-avatar-edit">✏️</button>
                    </div>
                    <div class="buddy-toggle-text">Ask Buddy ✨</div>
                </button>
                <!-- Popup (no backdrop container) -->
                <div id="buddy-popup">
                    <div class="buddy-avatar">
                        <img src="' . esc_url($avatar_url) . '" alt="Buddy Avatar" width="80" height="80" style="border-radius: 50%;" />
                        <button class="buddy-avatar-edit">✏️</button>
                    </div>
                    <div class="buddy-speech-bubble">
                        Hey, I\'m Buddy! I am here to read with you. How can I help you? <button class="buddy-speaker-btn">🔊</button>
                    </div>
                    <div class="buddy-options">
                        <button class="buddy-option-btn" data-action="sentence">Help with a sentence</button>
                        <button class="buddy-option-btn" data-action="word">Help with a word</button>
                    </div>
                    <button class="buddy-mic-btn">
                        <img src="' . esc_url($microphone_url) . '" alt="Microphone" width="24" height="24" />
                    </button>
                </div>
            </div>
            
            <!-- Avatar Customization Modal -->
            <div id="buddy-avatar-modal" class="buddy-modal-backdrop" style="display: none;">
                <!-- Content will be generated by JavaScript -->
            </div>`;
            
            // Inject at end of body
            document.body.insertAdjacentHTML("beforeend", buddyHTML);
            
            // Debug log for troubleshooting
            console.log("Buddy Companion: Injected via JavaScript fallback");
        });
    </script>';
}

// Enhanced output function with better duplicate detection
function buddy_output_html() {
    // BACKEND DEVS: ADD USER PERMISSION CHECKS HERE!
    // if (!current_user_can('use_buddy_companion')) { return; }
    // ALSO CHECK IF USER HAS BUDDY ENABLED IN THEIR SETTINGS
    // if (!get_user_meta(get_current_user_id(), 'buddy_enabled', true)) { return; }
    
    // Global tracking to prevent any duplicates across all hooks
    global $buddy_html_output;
    if ($buddy_html_output) return;
    $buddy_html_output = true;
    
    //(Vanessa) Load user's saved avatar from the database
    $user_id = get_current_user_id();
    $character = get_user_meta($user_id, 'buddy_avatar_character', true) ?: '🙂';
    $accessories = get_user_meta($user_id, 'buddy_avatar_accessories', true) ?: '';
    $avatar_html = '<div class="buddy-avatar-emoji-display">' . esc_html($character);
    if (!empty($accessories)) {
        $avatar_html .= ' ' . esc_html($accessories);
    }
    $avatar_html .= '</div>';

                echo '<div id="buddy-root">
            <button id="buddy-toggle">
                <div class="buddy-toggle-avatar">
                    <img src="' . esc_url($avatar_url) . '" alt="Buddy Avatar" width="60" height="60" style="border-radius: 50%;" />
                    <button class="buddy-avatar-edit">✏️</button>
                </div>
                <div class="buddy-toggle-text">Ask Buddy ✨</div>
            </button>
            <!-- Popup (no backdrop container) -->
            <div id="buddy-popup">
                <div class="buddy-avatar">
                    <img src="' . esc_url($avatar_url) . '" alt="Buddy Avatar" width="80" height="80" style="border-radius: 50%;" />
                    <button class="buddy-avatar-edit">✏️</button>
                </div>
                <div class="buddy-speech-bubble">
                    Hey, I\'m Buddy! I am here to read with you. How can I help you? <button class="buddy-speaker-btn">🔊</button>
                </div>
                <div class="buddy-options">
                    <button class="buddy-option-btn" data-action="sentence">Help with a sentence</button>
                    <button class="buddy-option-btn" data-action="word">Help with a word</button>
                </div>
                <button class="buddy-mic-btn">
                    <img src="' . plugin_dir_url(__FILE__) . 'images/microphone.png" alt="Microphone" width="24" height="24" />
                </button>
            </div>
          </div>
          
          <!-- Avatar Customization Modal -->
          <div id="buddy-avatar-modal" class="buddy-modal-backdrop" style="display: none;">
            <!-- Content will be generated by JavaScript -->
          </div>';
          
    // Debug output for troubleshooting
    echo '<!-- Buddy Companion: Injected via PHP hook -->';
}

// Multiple injection strategies for maximum compatibility
add_action('wp_body_open', 'buddy_output_html', 10);           // Primary: Standard themes
add_action('wp_footer', 'buddy_output_html', 10);              // Secondary: Most themes
add_action('wp_print_footer_scripts', 'buddy_output_html', 5); // Tertiary: Custom templates
add_action('wp_head', 'buddy_inject_js_fallback', 20);         // Final fallback: JavaScript injection

//(Vanessa) Rest API endpoints for buddy 
add_action('rest_api_init', 'buddy_register_api_routes');

function buddy_register_api_routes(){
    //Save/load user avatar preferences 
    register_rest_route('buddy/v1', '/avatar', array(
        'methods' => array('GET', 'POST'),
        'callback' => 'buddy_handle_avatar_api',
        'permission_callback' => function(){
            return is_user_logged_in();
        }
    ));
    //AI processing endpoint for sentences/words 
    register_rest_route('buddy/v1', '/analyze', array(
        'methods' => 'POST', 
        'callback' => 'buddy_handle_ai_analysis', 
        'permission_callback' => function(){
            return is_user_logged_in();
        }
    ));
    //Save user reading progress/interactions 
    register_rest_route('buddy/v1', '/progress', array(
        'methods' => 'POST',
        'callback' => 'buddy_save_reading_progress',
        'permission_callback' => function(){
            return is_user_logged_in();
        }
    ));
}

//(Vanessa) Handle Avatar API Requests 
function buddy_handle_avatar_api(WP_REST_Request $request) {
    global $wpdb;
    $user_id = get_current_user_id();
    $table = $wpdb->prefix . 'buddy_user_preferences';

    if ($request->get_method() === 'GET') {
        // Load existing avatar data
        $row = $wpdb->get_row($wpdb->prepare("SELECT avatar_character, avatar_accessories FROM $table WHERE user_id = %d", $user_id));
        //Returns default avatar if none are saved
        return new WP_REST_Response(array(
            'character' => $row ? $row->avatar_character : 'sun',
            'accessories' => $row ? json_decode($row->avatar_accessories ?: '[]') : array()
        ), 200);
    }
    //Save/update avatar data 
    if ($request->get_method() === 'POST') {
        //Save avatar data
        $character = sanitize_text_field($request->get_param('character'));
        $accessories = (array) $request->get_param('accessories');
        $accessories_json = wp_json_encode(array_map('sanitize_text_field', $accessories));

        //Checks if the user already has an avatar saved
        $exists = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE user_id = %d", $user_id));

        if ($exists) {
            //Update existing row
            $wpdb->update($table, array(
                'avatar_character' => $character,
                'avatar_accessories' => $accessories_json
            ), array('user_id' => $user_id));
        } else {
            //Insert new row
            $wpdb->insert($table, array(
                'user_id' => $user_id,
                'avatar_character' => $character,
                'avatar_accessories' => $accessories_json
            ));
        }
        //Returns a success response
        return new WP_REST_Response(array('success' => true), 200);
    }
    //Returns an error response 
    return new WP_REST_Response(array('error' => 'Method not allowed'), 405);
}


// Created Avatar Datebase
function buddy_create_user_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    $prefs_table = $wpdb->prefix . 'buddy_user_preferences';
    //Contains user_id and avatar preferences 
    $sql = "CREATE TABLE $prefs_table (
        user_id bigint(20) NOT NULL,
        avatar_character varchar(50) DEFAULT 'sun',
        avatar_accessories text,
        PRIMARY KEY (user_id)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'buddy_create_user_tables');

add_action("admin_notices", "show_book");
function show_book() {
    // Get the current book title to determine which book to load
    $current_book_title = get_current_book_title();
    // Find the correct book directory based on the title
    $book_folder = find_book_folder($current_book_title);
    if (!$book_folder) {
        echo '<div class="notice notice-error is-dismissible"><p>Could not find book folder for: ' . esc_html($current_book_title) . '</p></div>';
        return;
    }
    $pages_dir = plugin_dir_path(__FILE__) . '../../themes/readeezy/books/custom/' . $book_folder . '/pages/';
    $page_files = glob($pages_dir . 'page-*.html', GLOB_NOSORT);
    // Sort files by filename number to get correct order
    usort($page_files, function($a, $b) {
        $numA = (int)preg_replace('/[^0-9]/', '', basename($a));
        $numB = (int)preg_replace('/[^0-9]/', '', basename($b));
        return $numA - $numB;
    });
    // Page numbering configuration
    $starting_page = 5;  // First actual story page number
    $page_increment = 2; // Increment between pages (3, 5, 7, 9, etc.)
    $all_contents = '';
    $removeHtml = array("<p>", "</p>");
    if ($page_files) {
        foreach ($page_files as $index => $file_path) {
            // Calculate actual page number based on position in sorted array
            $actual_page_number = $starting_page + ($index * $page_increment);
            $contents = file_get_contents($file_path);
            $contents = str_replace($removeHtml, "", $contents);
            $contents = str_replace("<h1>","{",$contents);
            $contents = str_replace("</h1>","}",$contents);
            //$contents = strip_tags($contents);
            $all_contents .= "[PAGE " . $actual_page_number . "]" . esc_html($contents) . "[/PAGE " . $actual_page_number . "]<br><br>";
        }
    } else {
        echo '<div class="notice notice-error is-dismissible"><p>No page files found in: ' . esc_html($pages_dir) . '</p></div>';
    }
    // echo '<div class="notice notice-success is-dismissible"><p>' . $all_contents . '</p></div>';
    return $all_contents;
}
// Function to find the best matching book folder based on title
function find_book_folder($book_title) {
    $custom_dir = plugin_dir_path(__FILE__) . '../../themes/readeezy/books/custom/';
    // Get all directories in the custom folder
    $directories = glob($custom_dir . '*', GLOB_ONLYDIR);
    if (empty($directories)) {
        return null;
    }
    // If book title is "Unknown Book", fall back to first available directory
    if ($book_title === 'Unknown Book') {
        return basename($directories[0]);
    }
    $best_match = null;
    $highest_similarity = 0;
    foreach ($directories as $dir) {
        $folder_name = basename($dir);
        // Clean both strings for comparison (lowercase, remove special chars)
        $clean_title = strtolower(preg_replace('/[^a-z0-9]/', '', $book_title));
        $clean_folder = strtolower(preg_replace('/[^a-z0-9]/', '', $folder_name));
        // Check for exact match first
        if ($clean_title === $clean_folder) {
            return $folder_name;
        }
        // Check if one contains the other
        if (strpos($clean_title, $clean_folder) !== false || strpos($clean_folder, $clean_title) !== false) {
            return $folder_name;
        }
        // Use similar_text for fuzzy matching
        similar_text($clean_title, $clean_folder, $similarity);
        if ($similarity > $highest_similarity) {
            $highest_similarity = $similarity;
            $best_match = $folder_name;
        }
    }
    // Return best match if similarity is above threshold (60%), otherwise first directory
    return ($highest_similarity > 60) ? $best_match : basename($directories[0]);
}

// Function to get current page from pager-active span - THIS IS WHAT YOU CALL
function get_current_readeezy_page() {
    $user_id = get_current_user_id();
    $stored_page = get_user_meta($user_id, 'readeezy_current_page', true);
    return $stored_page ? intval($stored_page) : 1;
}
// Function to get current book title from bookTitle element
function get_current_book_title() {
    // This returns the stored book title from user meta
    // The JavaScript below will capture and store it automatically
    return get_user_meta(get_current_user_id(), 'readeezy_current_book_title', true) ?: 'Unknown Book';
}
// AJAX handler to store the page number
add_action('wp_ajax_store_current_page', 'store_current_page_handler');
add_action('wp_ajax_nopriv_store_current_page', 'store_current_page_handler');
function store_current_page_handler() {
    $page = intval($_POST['page'] ?? 0);
    $user_id = get_current_user_id();
    if ($page > 0) {
        update_user_meta($user_id, 'readeezy_current_page', $page);
        update_user_meta($user_id, 'readeezy_page_timestamp', time());
        wp_send_json_success(['page' => $page, 'user' => $user_id]);
    } else {
        wp_send_json_error('Invalid page');
    }
}
// AJAX handler to store book title
add_action('wp_ajax_store_book_title', 'store_book_title_handler');
add_action('wp_ajax_nopriv_store_book_title', 'store_book_title_handler');
function store_book_title_handler() {
    $title = sanitize_text_field($_POST['title'] ?? '');
    $user_id = get_current_user_id();
    if (!empty($title)) {
        update_user_meta($user_id, 'readeezy_current_book_title', $title);
        wp_send_json_success(['title' => $title]);
    } else {
        wp_send_json_error('Invalid title');
    }
}
// Add JavaScript tracking for page changes
add_action('wp_head', 'add_readeezy_page_tracker');
function add_readeezy_page_tracker() {
    if (is_admin()) return;
    ?>
    <script type="text/javascript">
    // === CONSOLE LOGGING (for debugging) ===
    console.log(':book: Readeezy Page Tracker: Script loaded');
    // Function to initialize tracker
    function initializePageTracker() {
        var ajaxUrl = '<?php echo admin_url('admin-ajax.php'); ?>';
        var currentPage = null;
        // Function to get current page from DOM
        function getCurrentPageFromDOM() {
            var pageElement = document.querySelector('span.pager-active[data-page]');
            if (pageElement) {
                var page = parseInt(pageElement.getAttribute('data-page'));
                return page;
            } else {
                return null;
            }
        }
        // Function to send page to server
        function sendPageToServer(pageNumber) {
            if (pageNumber && pageNumber !== currentPage) {
                currentPage = pageNumber;
                // === CONSOLE LOGGING (for debugging) ===
                console.log(':book: Readeezy Page Tracker: Page changed to', pageNumber);
                fetch(ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'action=store_current_page&page=' + pageNumber
                })
                .then(response => response.json())
                .then(data => {
                    // === CONSOLE LOGGING (for debugging) ===
                    console.log(':book: Readeezy Page Tracker: Server updated successfully');
                })
                .catch(error => {
                    // === CONSOLE LOGGING (for debugging) ===
                    console.log(':book: Readeezy Page Tracker: Server update failed', error);
                });
            }
        }
        // Make functions globally available
        window.getCurrentReadeezyPage = getCurrentPageFromDOM;
        window.getCurrentStoredPage = function() { return currentPage; };
        // Initial check
        var initialPage = getCurrentPageFromDOM();
        if (initialPage) {
            sendPageToServer(initialPage);
        }
        // Monitor for changes every 3 seconds
        setInterval(function() {
            var newPage = getCurrentPageFromDOM();
            if (newPage && newPage !== currentPage) {
                sendPageToServer(newPage);
            }
        }, 3000);
        // Monitor for clicks
        document.addEventListener('click', function(e) {
            setTimeout(function() {
                var newPage = getCurrentPageFromDOM();
                if (newPage && newPage !== currentPage) {
                    sendPageToServer(newPage);
                }
            }, 1000);
        });
        // === CONSOLE LOGGING (for debugging) ===
        console.log(':book: Readeezy Page Tracker: Initialized successfully');
    }
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePageTracker);
    } else {
        initializePageTracker();
    }
    // Fallback initialization
    setTimeout(initializePageTracker, 3000);
    </script>
    <script type="text/javascript">
    // Simple book title tracker - separate from page tracking
    function captureBookTitle() {
        var titleElement = document.querySelector('#bookTitle');
        if (titleElement) {
            var title = titleElement.textContent.trim();
            if (title) {
                fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'action=store_book_title&title=' + encodeURIComponent(title)
                });
            }
        }
    }
    // Capture book title when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', captureBookTitle);
    } else {
        captureBookTitle();
    }
    </script>
    <?php
}
