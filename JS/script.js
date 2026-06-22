// ============================================
// EDIT THIS SECTION TO ADD OR MODIFY SUBJECTS AND TOPICS
// ============================================

const notesData = [
    {
        id: 1,
        name: "ADFA",
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
                link: "/HTML/adfanotes.html"
            },
           
          
        ]
    },
    {
        id: 2,
        name: "DCFA",
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
        icon: "fas fa-table",
        description: "Microsoft Excel tutorials and tips",
        topics: [
            {
                name: "case study 1",
                link: "/adfa.html"
            },
           
        ]
    },
    {
        id: 4,
        name: "Rs-cit",
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
        icon: "fa-solid fa-book",
        description: "Diploma in early childhood care and education",
        protected: true,
        topics: [
            {
                name: "login",
                link: "/HTML/login.html"
            }
        ]
    }
];

// ============================================
// NO NEED TO EDIT BELOW THIS LINE
// ============================================

// DOM Elements
const subjectsGrid = document.getElementById('subjectsGrid');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const topicsContainer = document.getElementById('topicsContainer');
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
