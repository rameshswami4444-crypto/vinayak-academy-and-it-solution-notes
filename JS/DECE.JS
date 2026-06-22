// ============================================
// EDIT THIS SECTION TO ADD OR MODIFY SUBJECTS AND TOPICS
// ============================================

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
                name: "login",
                link: "/HTML/ecce.html"
            }
        ]
    }
];

// ============================================
// NO NEED TO EDIT BELOW THIS LINE
// ============================================

// DOM Elements
const subjectsGrid = document.getElementById('subjectsGridDECE');
const modal = document.getElementById('modalDECE');
const modalTitle = document.getElementById('modalTitleDECE');
const topicsContainer = document.getElementById('topicsContainerDECE');
const closeBtn = document.querySelector('.close');

// Render subjects on page load
document.addEventListener('DOMContentLoaded', () => {
    renderSubjects();
});

// Render all subjects
function renderSubjects() {
    subjectsGrid.innerHTML = '';
    
    notesData.forEach(subject => {
        const subjectCard = document.createElement('div');
        subjectCard.className = 'subject-card';
        subjectCard.innerHTML = `
            <div class="subject-icon">
                <i class="${subject.icon}"></i>
            </div>
            <h2>${subject.name}</h2>
            <p>${subject.description}</p>
            <span class="topic-count">${subject.topics.length} topics</span>
        `;
        
       subjectCard.addEventListener('click', () => {
            if (subject.protected) {
                window.location.href = subject.topics[0].link;
                return;
            }

            openModal(subject);
        });
        subjectsGrid.appendChild(subjectCard);
    });
}



// Open modal with topics
function openModal(subject) {
    modalTitle.textContent = subject.name;
    topicsContainer.innerHTML = '';
    
    subject.topics.forEach(topic => {
        const topicItem = document.createElement('div');
        topicItem.className = 'topic-item';
        topicItem.innerHTML = `
            <span class="topic-name">${topic.name}</span>
            <button class="pdf-btn" onclick="openPDF('${topic.link}')">
                <i class="fas fa-file-pdf"></i> View PDF
            </button>
        `;
        topicsContainer.appendChild(topicItem);
    });
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Open PDF in new tab
function openPDF(link) {
    if (link.includes('YOUR_FILE_ID')) {
        alert('we are cooking your syllabus 😊');
        return;
    }
    window.open(link, '_blank');
}

// Close modal when clicking the X button
closeBtn.addEventListener('click', closeModal);

// Close modal when clicking outside the modal content
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
});
