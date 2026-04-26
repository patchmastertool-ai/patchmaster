/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html",
  ],
  darkMode: "class",
  theme: {
      extend: {
          "colors": {
              // Background colors
              "background": "#060e20",
              "surface": "#060e20",
              "surface-container-lowest": "#000000",
              "surface-container-low": "#06122d",
              "surface-container": "#05183c",
              "surface-container-high": "#031d4b",
              "surface-container-highest": "#00225a",
              "surface-dim": "#060e20",
              "surface-bright": "#002867",
              "surface-variant": "#00225a",
              
              // Primary colors
              "primary": "#7bd0ff",
              "primary-dim": "#47c4ff",
              "primary-container": "#004c69",
              "primary-fixed": "#c4e7ff",
              "primary-fixed-dim": "#a2dcff",
              "on-primary": "#004560",
              "on-primary-container": "#97d8ff",
              "on-primary-fixed": "#00445e",
              "on-primary-fixed-variant": "#006286",
              
              // Secondary colors
              "secondary": "#939eb5",
              "secondary-dim": "#939eb5",
              "secondary-container": "#313c4f",
              "secondary-fixed": "#d8e3fb",
              "secondary-fixed-dim": "#cad5ed",
              "on-secondary": "#152032",
              "on-secondary-container": "#b4c0d7",
              "on-secondary-fixed": "#354053",
              "on-secondary-fixed-variant": "#515c70",
              
              // Tertiary colors (yellow/gold)
              "tertiary": "#ffd16f",
              "tertiary-dim": "#edb210",
              "tertiary-container": "#fcc025",
              "tertiary-fixed": "#fcc025",
              "tertiary-fixed-dim": "#edb210",
              "on-tertiary": "#614700",
              "on-tertiary-container": "#563e00",
              "on-tertiary-fixed": "#3d2b00",
              "on-tertiary-fixed-variant": "#614700",
              
              // Error colors
              "error": "#ee7d77",
              "error-dim": "#bb5551",
              "error-container": "#7f2927",
              "on-error": "#490106",
              "on-error-container": "#ff9993",
              
              // Text colors
              "on-surface": "#dee5ff",
              "on-surface-variant": "#91aaeb",
              "on-background": "#dee5ff",
              
              // Border colors
              "outline": "#5b74b1",
              "outline-variant": "#2b4680",
              
              // Inverse colors
              "inverse-surface": "#faf8ff",
              "inverse-on-surface": "#4d556b",
              "inverse-primary": "#00668b",
              
              // Surface tint
              "surface-tint": "#7bd0ff"
          },
          "borderRadius": {
              "DEFAULT": "0.125rem",
              "lg": "0.25rem",
              "xl": "0.5rem",
              "full": "0.75rem"
          },
          "fontFamily": {
              "headline": ["Inter", "sans-serif"],
              "body": ["Inter", "sans-serif"],
              "label": ["Inter", "sans-serif"],
              "sans": ["Inter", "sans-serif"]
          },
          "fontSize": {
              // Label sizes (uppercase with wide letter-spacing)
              "label-sm": ["11px", { lineHeight: "1.4", letterSpacing: "0.05em" }],
              "label-md": ["13px", { lineHeight: "1.4", letterSpacing: "0.05em" }],
              
              // Body sizes
              "body-sm": ["13px", { lineHeight: "1.5" }],
              "body-md": ["14px", { lineHeight: "1.5" }],
              "body-lg": ["16px", { lineHeight: "1.5" }],
              
              // Headline sizes
              "headline-sm": ["24px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
              "headline-md": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
              "headline-lg": ["40px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
              
              // Display sizes (for critical metrics)
              "display-sm": ["40px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
              "display-md": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
              "display-lg": ["56px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
              
              // Legacy sizes for backward compatibility
              "xs": "10px",
              "sm": "11px",
              "base": "13px",
              "md": "14px",
              "lg": "18px",
              "xl": "24px",
              "2xl": "32px",
              "4xl": "40px"
          },
          "fontWeight": {
              "light": 300,
              "normal": 400,
              "medium": 500,
              "semibold": 600,
              "bold": 700,
              "extrabold": 800
          },
          "letterSpacing": {
              "tighter": "-0.02em",
              "tight": "-0.01em",
              "normal": "0",
              "wide": "0.02em",
              "wider": "0.15em",
              "widest": "0.2em"
          },
          "backdropBlur": {
              "xl": "20px",
              "2xl": "40px"
          },
          "spacing": {
              // Stitch design system spacing scale
              "0": "0",
              "1": "0.25rem",    // 4px
              "2": "0.5rem",     // 8px
              "3": "0.75rem",    // 12px
              "4": "1rem",       // 16px - minimum vertical spacing for list items
              "6": "1.5rem",     // 24px
              "8": "2rem",       // 32px
              "12": "3rem",      // 48px - standard breathing room between sections
              "16": "4rem",      // 64px
              "20": "5rem",      // 80px
              "24": "6rem",      // 96px
              "32": "8rem",      // 128px
              "40": "10rem",     // 160px
              "48": "12rem",     // 192px
              "56": "14rem",     // 224px
              "64": "16rem"      // 256px
          },
          "boxShadow": {
              // Ambient shadow for floating modals (40px blur, 0% spread)
              "ambient": "0 0 40px 0 rgba(0, 0, 0, 0.5)",
              "ambient-lg": "0 0 60px 0 rgba(0, 0, 0, 0.6)",
              // Subtle glow for warning badges (2px blur)
              "glow-warning": "0 0 2px 0 rgba(255, 209, 111, 0.5)",
              "glow-primary": "0 0 4px 0 rgba(123, 208, 255, 0.3)"
          }
      },
  },
  plugins: [
      function({ addUtilities }) {
          addUtilities({
              // Glass morphism effects
              ".glass-morphism": {
                  "background": "rgba(6, 18, 45, 0.8)",
                  "backdrop-filter": "blur(20px)",
                  "border": "1px solid rgba(91, 116, 177, 0.2)",
              },
              ".glass-gradient": {
                  "background": "linear-gradient(135deg, rgba(123, 208, 255, 0.1) 0%, rgba(123, 208, 255, 0) 40%)",
              },
              ".glass-gradient-secondary": {
                  "background": "linear-gradient(135deg, rgba(147, 158, 181, 0.1) 0%, rgba(147, 158, 181, 0) 40%)",
              },
              ".glass-gradient-tertiary": {
                  "background": "linear-gradient(135deg, rgba(255, 209, 111, 0.1) 0%, rgba(255, 209, 111, 0) 40%)",
              },
              // Ghost border (15% opacity outline-variant)
              ".ghost-border": {
                  "border": "1px solid rgba(43, 70, 128, 0.15)",
              },
              ".ghost-border-full": {
                  "border": "1px solid #2b4680",
              },
              // Typography utilities
              ".text-label-uppercase": {
                  "text-transform": "uppercase",
                  "letter-spacing": "0.05em",
              },
              ".text-headline-tight": {
                  "letter-spacing": "-0.02em",
              },
              // Status badge utilities
              ".badge-success": {
                  "color": "#7bd0ff",
                  "background-color": "#004c69",
                  "padding": "0.25rem 0.75rem",
                  "border-radius": "0.25rem",
                  "font-size": "11px",
                  "font-weight": "500",
                  "text-transform": "uppercase",
                  "letter-spacing": "0.05em",
              },
              ".badge-warning": {
                  "color": "#ffd16f",
                  "background-color": "rgba(252, 192, 37, 0.2)",
                  "padding": "0.25rem 0.75rem",
                  "border-radius": "0.25rem",
                  "font-size": "11px",
                  "font-weight": "500",
                  "text-transform": "uppercase",
                  "letter-spacing": "0.05em",
                  "box-shadow": "0 0 2px 0 rgba(255, 209, 111, 0.5)",
              },
              ".badge-error": {
                  "color": "#ff9993",
                  "background-color": "#7f2927",
                  "padding": "0.25rem 0.75rem",
                  "border-radius": "0.25rem",
                  "font-size": "11px",
                  "font-weight": "500",
                  "text-transform": "uppercase",
                  "letter-spacing": "0.05em",
              },
              // Widget accent line (2px top border)
              ".widget-accent-success": {
                  "border-top": "2px solid #7bd0ff",
              },
              ".widget-accent-warning": {
                  "border-top": "2px solid #ffd16f",
              },
              ".widget-accent-error": {
                  "border-top": "2px solid #ee7d77",
              },
              // Material Symbols icon styling
              ".material-symbols": {
                  "font-family": "'Material Symbols Outlined'",
                  "font-weight": "300",
                  "font-style": "normal",
                  "font-size": "20px",
                  "line-height": "1",
                  "letter-spacing": "normal",
                  "text-transform": "none",
                  "display": "inline-block",
                  "white-space": "nowrap",
                  "word-wrap": "normal",
                  "direction": "ltr",
                  "font-feature-settings": "'liga'",
                  "-webkit-font-smoothing": "antialiased",
              },
          })
      }
  ],
}
