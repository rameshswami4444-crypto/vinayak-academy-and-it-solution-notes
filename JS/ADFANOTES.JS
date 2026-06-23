const notesData = [
    {
        id: 1,
        name: "GST NOTES",
        icon: "fas fa-calculator",
        description: "goods and service tax notes",
        topics: [
            {
                name: "GST NOTES",
                link: "https://drive.google.com/file/d/1xrAOhSXe5d-i-Daipdaln_BzLHc-3yHS/view?usp=sharing"
            }
        ]
    }
];

document.addEventListener("DOMContentLoaded", function () {
    window.VinayakNotesPage.initNotesPage({
        notesData: notesData,
        gridId: "subjectsGrid2",
        modalId: "modal2",
        modalTitleId: "modalTitle2",
        topicsContainerId: "topicsContainer2",
        comingSoonMessage: "we are cooking your notes"
    });
});
