const notesData = [
    {
        id: 1,
        name: "VOUCHER ENTRIES",
        icon: "fas fa-calculator",
        description: "journal entries   ",
        topics: [
            {
                name: "vouture entries",
                link: "https://drive.google.com/file/d/1xrAOhSXe5d-i-Daipdaln_BzLHc-3yHS/view?usp=sharing"
            }
        ]
    },
    {
        id: 2,
        name: "ITEM INVOICE ENTRIES",
        icon: "fas fa-calculator",
        description: " item sale purchase entries",
        topics: [
            {
                name: "item invoice entries",
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
