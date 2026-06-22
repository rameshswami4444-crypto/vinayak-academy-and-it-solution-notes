
        const pdfViewer = document.getElementById("pdfViewer");
        const noteButtons = document.querySelectorAll(".note-btn");

        noteButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                const fileId = button.getAttribute("data-file-id");

                if (!fileId || fileId.includes("YOUR_FILE_ID")) {
                    alert("PDF will be available soon");
                    return;
                }

                noteButtons.forEach(function (item) {
                    item.classList.remove("active");
                });

                button.classList.add("active");
                pdfViewer.src = "https://drive.google.com/file/d/" + fileId + "/preview";
            });
        });

        document.getElementById("logoutBtn").addEventListener("click", function () {
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("studentId");
            window.location.href = "/HTML/login.html";
        });
    