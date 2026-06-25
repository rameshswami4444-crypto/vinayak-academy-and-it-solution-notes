const notesData = [
    {
        id: 1,
        name: "ADFA",
        cardId: "adfa-card",
        courseKey: "ADFA",
        icon: "fas fa-calculator",
        description: "advanced deploma in finacial accounting ",
        topics: [
            {
                name: "basic accounting",
                link: "/HTML/basicnotes.html"
            },
            {
                name: "case studies",
                link: "/HTML/adfa.html"
            },
            {
                name: "NOTES",
                link: "/HTML/ADFANOTES.HTML"
            }
        ]
    },
    {
        id: 2,
        name: "DCFA",
        cardId: "dcfa-card",
        courseKey: "DCFA",
        icon: "fas fa-file-invoice-dollar",
        description: "deploma in computerized financial accounting",
        topics: [
            {
                name: "GST Basics and Overview",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_5/view?usp=sharing"
            },
            {
                name: "Registration and Compliance",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_6/view?usp=sharing"
            },
            {
                name: "GST Return Filing",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_7/view?usp=sharing"
            },
            {
                name: "Input Tax Credit",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_8/view?usp=sharing"
            }
        ]
    },
    {
        id: 3,
        name: "Excel",
        cardId: "excel-card",
        courseKey: "EXCEL",
        icon: "fas fa-table",
        description: "Microsoft Excel tutorials and tips",
        topics: [
            {
                name: "case study 1",
                link: "/adfa.html"
            }
        ]
    },
    {
        id: 4,
        name: "Rs-cit",
        cardId: "rscit-card",
        courseKey: "RS-CIT",
        icon: "fas fa-briefcase",
        description: "Rs-cit ",
        topics: [
            {
                name: "Introduction to Business",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_13/view?usp=sharing"
            },
            {
                name: "Business Organization",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_14/view?usp=sharing"
            },
            {
                name: "Marketing Strategies",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_15/view?usp=sharing"
            }
        ]
    },
    {
        id: 5,
        name: "CCC",
        cardId: "ccc-card",
        courseKey: "CCC",
        icon: "fas fa-chart-line",
        description: "CCC",
        topics: [
            {
                name: "Microeconomics",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_16/view?usp=sharing"
            },
            {
                name: "Macroeconomics",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_17/view?usp=sharing"
            },
            {
                name: "Supply and Demand",
                link: "https://drive.google.com/file/d/YOUR_FILE_ID_18/view?usp=sharing"
            }
        ]
    },
    {
        id: 6,
        name: "ECCE {IGNOU}",
        cardId: "ecce-card",
        courseKey: "ECCE",
        icon: "fa-solid fa-book",
        description: "Diploma in early childhood care and education",
        protected: true,
        topics: [
            {
                name: "open",
                link: "/HTML/DECE.HTML"
            }
        ]
    }
];

document.addEventListener("DOMContentLoaded", function () {
    window.VinayakNotesPage.initNotesPage({
        notesData: notesData,
        gridId: "subjectsGrid",
        modalId: "modal",
        modalTitleId: "modalTitle",
        topicsContainerId: "topicsContainer",
        comingSoonMessage: "we are cooking your syllabus"
    });
});
