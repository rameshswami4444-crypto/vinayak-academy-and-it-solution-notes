const notesData = [
    {
        id: 6,
        name: "ASSIGNMENT QUESTIONS",
        icon: "fa-solid fa-book",
        description: "Diploma in early childhood care and education",
        topics: [
            {
                name: "assingment 1",
                link: "https://www.ignou.ac.in/viewFile/SOCE/assignments/DECE-1-Hindi.pdf"
            },
            {
                name: "assingment 2",
                link: "https://www.ignou.ac.in/viewFile/SOCE/assignments/DECE-2-Hindi.pdf"
            },
            {
                name: "assingment 3",
                link: "https://www.ignou.ac.in/viewFile/SOCE/assignments/DECE-3-Hindi.pdf"
            }
        ]
    },
    {
        id: 7,
        name: "SOLVED ASSINGMENTS",
        icon: "fa-solid fa-book",
        description: "Diploma in early childhood care and education",
        protected: true,
        topics: [
            {
                name: "open",
                link: "/HTML/ecce.html"
            }
        ]
    }
];

document.addEventListener("DOMContentLoaded", function () {
    window.VinayakNotesPage.initNotesPage({
        notesData: notesData,
        gridId: "subjectsGridDECE",
        modalId: "modalDECE",
        modalTitleId: "modalTitleDECE",
        topicsContainerId: "topicsContainerDECE",
        comingSoonMessage: "we are cooking your syllabus"
    });
});
