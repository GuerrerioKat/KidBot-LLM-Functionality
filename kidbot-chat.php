<?php
/**
 * Plugin Name: KidBot Chat
 * Description: A chatbot that helps kids understand books.
 * New Features: Added in voice transcirption so you can talk to the chatbot
 * Version: 1.1.0
 */

// Enqueue the JS
add_action('wp_enqueue_scripts', 'kidbot_enqueue_assets');
function kidbot_enqueue_assets() {
  wp_enqueue_script(
    'kidbot-chat-js',
    plugin_dir_url(__FILE__) . 'kidbot-chat.js',
    [], '1.0', true
  );
  wp_localize_script('kidbot-chat-js', 'kidbotChatSettings', [
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'postId'  => get_the_ID() ?: 0,
    'openaiApiKey' => defined('KIDBOT_OPENAI_API_KEY') ? KIDBOT_OPENAI_API_KEY : '',
    'elevenLabsApiKey' => defined('ELEVENLABS_API_KEY') ? ELEVENLABS_API_KEY : ''
  ]);
}

// Shortcode: just the markup
add_shortcode('kidbot_chat', 'kidbot_render_markup');
function kidbot_render_markup() {
  return '
        <div id="kidbot">
        <textarea id="kidbot-input"
                placeholder="Ask a question about the book…"></textarea>

        <div style="margin-top:.5em;">
        <button id="kidbot-mic"   title="Hold to speak">🎤</button>
        <button id="kidbot-send">Send</button>

        <label style="margin-left:.5em;">
            <input type="checkbox" id="kidbot-tts" checked>
            Read the answer aloud
        </label>
        </div>

        <div id="kidbot-response" style="margin-top:.5em;"></div>
    </div>
  ';
}

// The real AJAX handler
add_action('wp_ajax_kidbot_ask',      'kidbot_ask');
add_action('wp_ajax_nopriv_kidbot_ask','kidbot_ask');
function kidbot_ask() {
  error_log('[KidBot] ask() start.');

  // 3a) Gather + validate inputs
  $question = isset($_POST['question']) ? sanitize_text_field($_POST['question']) : '';
  $post_id  = isset($_POST['post_id'])  ? intval($_POST['post_id'])        : 0;
  if (!$question) {
    error_log('[KidBot] No question provided.');
    wp_send_json_error(['message'=>'Please ask a question first.']);
  }
  if (!$post_id) {
    error_log('[KidBot] No post_id provided.');
    wp_send_json_error(['message'=>'Invalid post.']);
  }

  // Fetch the book content
  $post = get_post($post_id);
  if (!$post) {
    error_log("[KidBot] get_post($post_id) failed.");
    wp_send_json_error(['message'=>'Book content not found.']);
  }
  $book_content = strip_tags($post->post_content);

  // Build the prompt
  $prompt = "You are a friendly reading assistant for children.\n\n"
          . "Book text:\n$book_content\n\n"
          . "Child asks: \"$question\"";

  // Your API key
  if ( defined('KIDBOT_OPENAI_API_KEY') && KIDBOT_OPENAI_API_KEY ) {
    $api_key = KIDBOT_OPENAI_API_KEY;
  } else {
    error_log('[KidBot] API key not set.');
    wp_send_json_error(['message'=>'Chatbot not configured.']);
  }

  // Call OpenAI
  $args = [
    'headers' => [
      'Authorization' => 'Bearer ' . $api_key,
      'Content-Type'  => 'application/json',
    ],
    'body'    => wp_json_encode([
      'model'       => 'gpt-4o-mini',
      'messages'    => [
        ['role'=>'system','content'=>'You help kids understand stories in simple, friendly language.'],
        ['role'=>'user',  'content'=>$prompt]
      ],
      'temperature' => 0.7,
    ]),
    'timeout' => 20,
  ];
  $resp = wp_remote_post('https://api.openai.com/v1/chat/completions', $args);
  if ( is_wp_error($resp) ) {
    $err = $resp->get_error_message();
    error_log("[KidBot] wp_remote_post error: $err");
    wp_send_json_error(['message'=>"Request failed: $err"]);
  }

  $raw = wp_remote_retrieve_body($resp);
  error_log("[KidBot] OpenAI raw response: $raw");
  $body = json_decode($raw, true);
  if (!$body || !isset($body['choices'][0]['message']['content'])) {
    error_log('[KidBot] JSON parse failed or missing content.');
    wp_send_json_error(['message'=>'Bad response from OpenAI.']);
  }

  $reply = trim($body['choices'][0]['message']['content']);
  if ($reply === '') {
    error_log('[KidBot] Empty reply.');
    wp_send_json_error(['message'=>'No reply generated.']);
  }

  // Success!
  error_log("[KidBot] Reply: $reply");
  wp_send_json_success(['reply'=>$reply]);
}