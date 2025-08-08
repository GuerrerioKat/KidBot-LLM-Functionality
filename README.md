# Buddy Companion - AI Reading Assistant WordPress Plugin

A WordPress plugin that adds an AI-powered conversational reading companion to book pages on the Readeezy platform. Buddy helps users with word definitions, sentence comprehension, and social-emotional learning through contextual conversations.

## Features

### ✅ Complete Avatar Customization System
- **Character Selection**: Choose from 9 unique emoji characters (sun, animals, etc.)
- **Multi-Select Accessories**: Add hats, glasses, crowns, and other accessories
- **Real-time Preview**: See changes instantly with character + accessory layering
- **Persistent Storage**: Selections saved via localStorage across page reloads
- **Dynamic Updates**: Avatar changes apply to all instances (floating button, popup)

### ✅ Voice Synthesis
- **Text-to-Speech**: Click speaker buttons to hear Buddy's messages aloud
- **Voice Optimization**: Configured for clarity and friendliness
- **Universal Support**: Works across all speech bubble states

### ✅ Interactive Reading Modes
- **Sentence Help**: Highlighter cursor for selecting sentences needing assistance
- **Word Help**: Highlighter cursor for selecting individual words
- **State Management**: Smooth transitions between help modes and main menu
- **Smart Cursor**: Automatically disabled during avatar customization for better UX

## Installation

1. Upload the `buddy-companion` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. The floating "Ask Buddy" button will appear on all pages

### ⚠️ Important: Custom Template Integration

**For Buddy Companion to work on custom book pages like Crazy Legs**, you need to add this code to your custom template file:

**File**: `/wp-content/themes/readeezy/page-crazylegs.php`  
**Location**: After line 310 (after the last `<script>` tag, before closing `</body>`)  
**Code to Add**:
```php
<?php 
// Enable Buddy Companion on custom templates
do_action('wp_print_footer_scripts'); 
?>
```

**Example**:
```php
<!-- Line 310: existing script tag -->
<script src="<?php echo $coreURL; ?>/js/tabletDetection.js"></script>

<!-- ADD THESE LINES (312-315): -->
<?php 
// Enable Buddy Companion on custom templates
do_action('wp_print_footer_scripts'); 
?>

</body>
</html>
```

This ensures Buddy Companion loads on custom book templates that bypass standard WordPress hooks.

## File Structure

```
buddy-companion/
├── buddy.php          # Main plugin file, WordPress hooks, HTML structure
├── buddy.js           # Frontend interactions, voice synthesis, avatar system
├── buddy.css          # UI styling with utility classes, responsive design
├── .gitignore         # Excludes images directory
└── README.md          # This file
```

## Technical Implementation



## Usage

### Basic Navigation
1. Click the floating "Ask Buddy" button to open the interface
2. Choose between "Help with a sentence" or "Help with a word"
3. Use the highlighter cursor to select text for assistance
4. Click speaker buttons (🔊) to hear messages read aloud

### Avatar Customization
1. Hover over any Buddy avatar to see the edit pencil (✏️)
2. Click the pencil to open the customization modal
3. **Character Tab**: Select from 9 character options (single-select)
4. **Accessory Tab**: Toggle multiple accessories (multi-select)
5. See real-time preview of your selections
6. Click "Done" to save and apply changes everywhere

### Keyboard Shortcuts
- **Escape**: Close avatar customization modal
- **Click outside modal**: Close avatar customization modal






- Test avatar customization and voice synthesis across browsers

## Backend Integration Guide

### 🔧 Ready for Backend Development
The code includes **ALL CAPS comments** throughout all files marking where backend developers should implement:

- **User Authentication**: Login checks and permission validation
- **Database Integration**: Replace localStorage with user profile storage
- **AI Processing**: Connect sentence analysis to OpenAI/Anthropic APIs
- **Analytics**: Reading progress and interaction tracking
- **REST API**: Endpoints for frontend-backend communication
- **Personalization**: User-specific messaging and voice preferences


// buddy/v1/progress - POST reading interactions for analytics
```

## License

This plugin is developed for the Readeezy platform. All rights reserved.


