/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#0052CC",
                "primary-dark": "#0747A6",
                "bg-light": "#F4F5F7",
                "bg-dark": "#091E42",
                surface: "#FFFFFF",
                "border-app": "#DFE1E6",
                "text-main": "#091E42",
                "text-muted": "#5E6C84",
                success: "#006644",
                "success-light": "#E3FCEF",
                warning: "#FF8B00",
                danger: "#DE350B",
                "danger-light": "#FFEBE6",
            },
            fontFamily: {
                display: ["Inter"],
                mono: ["SpaceMono"],
            },
        },
    },
    plugins: [],
};
