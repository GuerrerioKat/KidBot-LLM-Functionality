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

add_action( 'init', function () { if ( ! session_id() ) session_start(); } );
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
  //$book_content = strip_tags($post->post_content);
  $book_content = "
  I knew I was really in trouble when Little Ty pulled out a sword.

  “Where’s my phone, Crazylegs?” he said.

  That was typical Little Ty. He had to be different, over the top. Somehow, he had got hold of a katana—that’s a Japanese samurai sword—and there he was, waving it at me.

  I had no idea whether it was sharp enough to cut me, but I wasn’t going to wait around and find out. I turned and ran.

  Ty didn’t bother to chase after me. He knew he couldn’t catch me, even if he wasn’t dragging around forty inches of steel. He’s about five feet six, and I passed six feet when I was thirteen.

For a while I didn’t know what to do with my long legs, and everyone laughed at how I walked. That’s how I got the name “Crazylegs.”

Now though, I’m sixteen years old and six feet four inches tall. I can run faster than any kid in our neighborhood. But Little Ty knew he didn’t need to chase me.

“I know where you live!” he yelled after me.

  That was true, but he wouldn’t come round at night. There was someone at my house that had all the neighborhood kids quaking with fear. Including me.

“Connor!” my Mom yelled.

I was trying to sneak in through the back door, but Mom had ears like a bat.

“Connor Crane, where have you been?” she said.

I thought about what had happened. Did I dare tell Mom about the trouble I was in? Maybe she could help. But then, maybe I would rather face Little Ty with a sword than get Mom angry.
  
The evening had started out pretty normal. I was shooting hoops down at the outdoor court, waiting for my friends. A girl was watching me.

I’d seen her hanging around with a group of kids, but now she was on her own. She looked tough, but pretty. I tried a fadeaway shot to impress her. That’s a trick shot where you fall backwards as you throw the ball, but I tried too hard and fell on my backside.

“Hey, Crazylegs! Rolling in the dirt, where you belong?”

Little Ty was walking across, calling to me. I tried to sneak off, because I didn’t want the girl hearing my dumb nickname. But he stood in my way.

“I don’t want any trouble,” I said.

Little Ty smiled nastily. I didn’t know why he’s always picking on me. Maybe it’s because I’m so tall and he’s so short—like he’s trying to make up for it.

";

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
    error_log('[KidBot] API key not set.');
    wp_send_json_error(['message'=>'Chatbot not configured.']);
  }

  $messages = $_SESSION['kidbot_history'] ?? [
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
  $messages[] = ['role' => 'assistant', 'content' => $reply];
  $_SESSION['kidbot_history'] = $messages;

  // Success!
  error_log("[KidBot] Reply: $reply");
  wp_send_json_success(['reply'=>$reply]);
}