const fs = require('fs');
const { chromium } = require('playwright');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt({ html: true });

(async () => {
    try {
        const markdownContent = fs.readFileSync('C:/Users/test/.gemini/antigravity/brain/e8d26dc8-71a8-4b25-bd06-919d4ff0b1a3/codebase_analysis.md', 'utf-8');
        let htmlContent = md.render(markdownContent);
        
        // Add some basic styling so the PDF looks presentable
        htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: #1a202c; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            pre { background-color: #f7fafc; padding: 15px; border-radius: 5px; overflow-x: auto; }
            code { font-family: Consolas, Monaco, "Andale Mono", monospace; background-color: #f7fafc; padding: 2px 4px; border-radius: 3px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background-color: #f7fafc; }
            blockquote { border-left: 4px solid #cbd5e0; margin: 0; padding-left: 15px; color: #4a5568; }
        </style>
        </head>
        <body>
        ${htmlContent}
        </body>
        </html>
        `;

        // Launch edge to avoid downloading chromium
        const browser = await chromium.launch({ channel: 'msedge' });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle' });
        
        await page.pdf({ 
            path: 'C:/Users/test/Desktop/pat-1/Codebase_Analysis.pdf', 
            format: 'A4',
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            printBackground: true 
        });
        
        await browser.close();
        console.log("PDF created successfully at C:/Users/test/Desktop/pat-1/Codebase_Analysis.pdf");
    } catch (e) {
        console.error("Error creating PDF:", e);
        process.exit(1);
    }
})();
