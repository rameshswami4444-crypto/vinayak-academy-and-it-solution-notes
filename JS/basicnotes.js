// ============================================
// EDIT THIS SECTION TO ADD OR MODIFY SUBJECTS AND TOPICS
// ============================================

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
            },
           
          
           
        ]
    },{
        id: 1,
        name: "ITEM INVOICE ENTRIES",
        icon: "fas fa-calculator",
        description: " item sale purchase entries",
        topics: [
            
             {
                name: "item invoice entries",
                link: "https://drive.google.com/file/d/1xrAOhSXe5d-i-Daipdaln_BzLHc-3yHS/view?usp=sharing"
            },
          
           
        ]
    }]

// ============================================
// NO NEED TO EDIT BELOW THIS LINE
// ============================================

// DOM Elements
const subjectsGrid = document.getElementById('subjectsGrid2');
const modal = document.getElementById('modal2');
const modalTitle = document.getElementById('modalTitle2');
const topicsContainer = document.getElementById('topicsContainer2');
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
        
        subjectCard.addEventListener('click', () => openModal(subject));
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
        alert('we are cooking your notes😊');
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
