# Notes Sharing Website

A clean, responsive website for sharing study notes and educational materials with easy-to-edit configuration.

## Features

✅ **Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
✅ **Subject Cards** - Beautiful card layout with icons and topic counts
✅ **Modal Popups** - View all topics for a subject in a smooth modal dialog
✅ **Google Drive Integration** - Direct links to PDFs on Google Drive
✅ **Easy to Configure** - Edit subjects and topics directly in JavaScript array
✅ **No Backend Required** - Pure HTML, CSS, and JavaScript
✅ **Modern UI** - Gradient backgrounds, smooth animations, hover effects

## File Structure

```
├── index.html      # Main HTML structure
├── styles.css      # Responsive styling and animations
├── script.js       # JavaScript logic and data configuration
└── README.md       # This file
```

## How to Use

### 1. **Opening the Website**
Simply open `index.html` in any web browser. No server setup required!

### 2. **Adding/Editing Subjects and Topics**

Open `script.js` and find the `notesData` array at the top. This is where you configure everything:

```javascript
const notesData = [
    {
        id: 1,
        name: "Subject Name",           // Display name
        icon: "fas fa-icon-name",       // Font Awesome icon class
        description: "Subject info",    // Short description
        topics: [
            {
                name: "Topic Name",
                link: "Google Drive PDF URL"
            },
            // ... more topics
        ]
    },
    // ... more subjects
];
```

### 3. **Getting Google Drive PDF Links**

1. Upload your PDF to Google Drive
2. Right-click the file → Share
3. Click "Change to anyone with the link"
4. Copy the shareable link
5. Replace `YOUR_FILE_ID` in the format: `https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing`

**Example:** If your link is `https://drive.google.com/file/d/1ABC123XYZ456/view?usp=sharing`, 
the file ID is `1ABC123XYZ456`.

### 4. **Customizing Icons**

Use Font Awesome icons from: https://fontawesome.com/icons

Popular icons:
- `fas fa-book` - Books
- `fas fa-calculator` - Math/Accounts
- `fas fa-table` - Spreadsheet/Excel
- `fas fa-briefcase` - Business
- `fas fa-chart-line` - Economics/Finance
- `fas fa-file-pdf` - PDF
- `fas fa-code` - Programming
- `fas fa-test-tube` - Science

### 5. **Customizing Colors**

Edit the CSS variables in `styles.css`:

```css
:root {
    --primary-color: #6366f1;      /* Main blue */
    --secondary-color: #8b5cf6;    /* Purple */
    --accent-color: #ec4899;       /* Pink */
    --light-bg: #f8fafc;           /* Light background */
    --text-dark: #1e293b;          /* Dark text */
    --text-light: #64748b;         /* Light text */
}
```

## Examples of Complete Setup

### Example 1: Simple Subject
```javascript
{
    id: 1,
    name: "Mathematics",
    icon: "fas fa-calculator",
    description: "Math notes and formulas",
    topics: [
        {
            name: "Algebra Basics",
            link: "https://drive.google.com/file/d/1ABC123/view?usp=sharing"
        }
    ]
}
```

### Example 2: Multiple Topics
```javascript
{
    id: 2,
    name: "History",
    icon: "fas fa-history",
    description: "Historical events and timelines",
    topics: [
        {
            name: "Ancient Civilizations",
            link: "https://drive.google.com/file/d/2XYZ789/view?usp=sharing"
        },
        {
            name: "Medieval Period",
            link: "https://drive.google.com/file/d/3DEF456/view?usp=sharing"
        },
        {
            name: "Modern History",
            link: "https://drive.google.com/file/d/4GHI123/view?usp=sharing"
        }
    ]
}
```

## Features Explained

### 📱 Mobile Responsive
- Automatically adjusts layout for phones, tablets, and desktops
- Touch-friendly buttons and spacing
- Mobile-optimized modal dialogs

### 🎨 Interactive Elements
- Hover effects on cards (lift and highlight)
- Smooth animations for modals
- Ripple effects on buttons
- Keyboard navigation (Escape to close modal)

### ⚡ User Experience
- Fast loading (no external dependencies except Font Awesome)
- Search-friendly structure
- Accessibility-focused design
- Dark/light theme compatible

## Troubleshooting

### PDFs not opening?
- Check the Google Drive link format is correct
- Ensure the PDF is shared and publicly accessible
- Use the full shareable link, not the shortened one

### Icons not showing?
- Verify Font Awesome CDN is accessible
- Check the icon class name is correct
- Use https:// links (not http://)

### Layout issues on mobile?
- Clear browser cache
- Check if all CSS is loaded properly
- Test in different browsers

## Deployment

### Option 1: Static Hosting (Recommended)
Upload all files to:
- GitHub Pages (free)
- Vercel (free)
- Netlify (free)
- Any static file hosting service

### Option 2: Local Use
Just open `index.html` in any browser. Works offline!

### Option 3: Simple Web Server
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (with npx)
npx http-server
```
Then visit: http://localhost:8000

## Tips for Success

1. **Organize Subjects** - Keep related topics together in one subject
2. **Clear Naming** - Use descriptive names for easy understanding
3. **Icon Consistency** - Use relevant icons for quick visual recognition
4. **Link Testing** - Test all PDF links before deploying
5. **Regular Updates** - Keep the `notesData` array updated with new materials

## Browser Support

✅ Chrome/Chromium
✅ Firefox
✅ Safari
✅ Edge
✅ Mobile browsers (iOS Safari, Chrome Mobile)

## License

Feel free to use and modify this project for personal or educational purposes.

## Support

For issues or suggestions:
1. Check the troubleshooting section
2. Verify all file paths are correct
3. Test with sample data first
4. Clear browser cache and reload

---

**Happy Learning! 📚**
