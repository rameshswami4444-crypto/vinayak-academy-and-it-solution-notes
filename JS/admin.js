(function () {
    let studentsCache = [];

    function getIdentifier(student) {
        return student[window.VinayakAuth.getStudentIdentifierColumn()] || student.id || student.name || "";
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function fetchStudents() {
        const client = window.VinayakAuth.getClient();
        const identifierColumn = window.VinayakAuth.getStudentIdentifierColumn();
        const { data, error } = await client
            .from(window.VinayakAuth.getStudentsTableName())
            .select(identifierColumn + ", course, password, fees_status, due_date, payment_note, session_id")
            .order(identifierColumn, { ascending: true });

        if (error) {
            throw error;
        }

        return (data || []).map(function (student) {
            return Object.assign({}, student, {
                course: window.VinayakAuth.normalizeSingleCourse(student.course),
                fees_status: window.VinayakAuth.normalizeFeesStatus(student.fees_status),
                due_date: window.VinayakAuth.normalizeDateValue(student.due_date),
                payment_note: student.payment_note || ""
            });
        });
    }

    function setPanelMessage(message, type) {
        const box = document.getElementById("adminPanelMessage");
        if (!box) {
            return;
        }

        box.hidden = false;
        box.textContent = message;
        box.className = "auth-message " + (type || "success");
    }

    function clearPanelMessage() {
        const box = document.getElementById("adminPanelMessage");
        if (!box) {
            return;
        }

        box.hidden = true;
        box.textContent = "";
        box.className = "auth-message";
    }

    function formatDisplayDate(value) {
        return value || "-";
    }

    function getFeePayload(fields) {
        const status = window.VinayakAuth.normalizeFeesStatus(fields.feesStatus);
        const dueDate = window.VinayakAuth.normalizeDateValue(fields.dueDate);
        const paymentNote = String(fields.paymentNote || "").trim();

        if (status === "due" && !dueDate) {
            throw new Error("Select a due date whenever fee status is set to due.");
        }

        return {
            fees_status: status,
            due_date: dueDate || null,
            payment_note: paymentNote || null
        };
    }

    function renderStudents(students) {
        const tbody = document.getElementById("studentsTableBody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = "";

        if (!students.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="6" class="admin-empty">No students found in Supabase.</td>';
            tbody.appendChild(row);
            return;
        }

        students.forEach(function (student) {
            const identifier = getIdentifier(student) || "-";
            const row = document.createElement("tr");
            row.innerHTML = [
                "<td>", escapeHtml(identifier), "</td>",
                "<td>", escapeHtml(student.course || "-"), "</td>",
                '<td><span class="status-badge ', student.fees_status === "paid" ? "status-paid" : "status-due", '">',
                escapeHtml(student.fees_status),
                "</span></td>",
                "<td>", escapeHtml(formatDisplayDate(student.due_date)), "</td>",
                "<td>", escapeHtml(student.payment_note || "-"), "</td>",
                '<td><button type="button" class="table-action-btn" data-edit-student="', escapeHtml(identifier), '">',
                '<i class="fas fa-pen"></i> Edit',
                "</button></td>"
            ].join("");
            tbody.appendChild(row);
        });
    }

    function applyStudentFilter() {
        const searchField = document.getElementById("studentSearchInput");
        const query = searchField ? searchField.value.trim().toLowerCase() : "";

        if (!query) {
            renderStudents(studentsCache);
            return;
        }

        renderStudents(
            studentsCache.filter(function (student) {
                return [
                    getIdentifier(student),
                    student.course,
                    student.fees_status,
                    student.payment_note
                ].some(function (value) {
                    return String(value || "").toLowerCase().includes(query);
                });
            })
        );
    }

    function getSelectedCourse(fieldId) {
        const courseField = document.getElementById(fieldId);
        return window.VinayakAuth.normalizeSingleCourse(courseField ? courseField.value : "");
    }

    async function refreshStudents() {
        studentsCache = await fetchStudents();
        applyStudentFilter();
    }

    function fillEditForm(student) {
        if (!student) {
            return;
        }

        document.getElementById("editStudentId").value = getIdentifier(student);
        document.getElementById("editStudentCourse").value = student.course || "";
        document.getElementById("editStudentPassword").value = student.password || "";
        document.getElementById("editFeesStatus").value = student.fees_status || "paid";
        document.getElementById("editDueDate").value = student.due_date || "";
        document.getElementById("editPaymentNote").value = student.payment_note || "";
    }

    function clearEditForm() {
        const form = document.getElementById("editStudentForm");
        if (form) {
            form.reset();
        }
        document.getElementById("editFeesStatus").value = "paid";
    }

    async function addStudent(event) {
        event.preventDefault();
        clearPanelMessage();

        const studentId = document.getElementById("newStudentId").value.trim();
        const studentPassword = document.getElementById("newStudentPassword").value.trim();
        const selectedCourse = getSelectedCourse("newStudentCourse");

        if (!studentId || !studentPassword || !selectedCourse) {
            setPanelMessage("Fill student ID, password, and select a course before saving.", "error");
            return;
        }

        try {
            const client = window.VinayakAuth.getClient();
            const payload = Object.assign({
                id: studentId,
                password: studentPassword,
                course: selectedCourse
            }, getFeePayload({
                feesStatus: document.getElementById("newFeesStatus").value,
                dueDate: document.getElementById("newDueDate").value,
                paymentNote: document.getElementById("newPaymentNote").value
            }));

            const { error } = await client.from(window.VinayakAuth.getStudentsTableName()).insert([payload]);

            if (error) {
                throw error;
            }

            document.getElementById("addStudentForm").reset();
            document.getElementById("newFeesStatus").value = "paid";
            setPanelMessage("Student added successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Add student failed", error);
            setPanelMessage(error.message || "Could not add student.", "error");
        }
    }

    async function updateStudent(event) {
        event.preventDefault();
        clearPanelMessage();

        const studentId = document.getElementById("editStudentId").value.trim();
        const newPassword = document.getElementById("editStudentPassword").value.trim();
        const selectedCourse = getSelectedCourse("editStudentCourse");

        if (!studentId || !newPassword || !selectedCourse) {
            setPanelMessage("Student ID, password, and course are required.", "error");
            return;
        }

        try {
            const client = window.VinayakAuth.getClient();
            const payload = Object.assign({
                password: newPassword,
                course: selectedCourse
            }, getFeePayload({
                feesStatus: document.getElementById("editFeesStatus").value,
                dueDate: document.getElementById("editDueDate").value,
                paymentNote: document.getElementById("editPaymentNote").value
            }));

            const { error } = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .update(payload)
                .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId);

            if (error) {
                throw error;
            }

            setPanelMessage("Student details updated successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Student update failed", error);
            setPanelMessage(error.message || "Could not update student.", "error");
        }
    }

    async function deleteStudent(event) {
        event.preventDefault();
        clearPanelMessage();

        const studentId = document.getElementById("deleteStudentId").value.trim();

        if (!studentId) {
            setPanelMessage("Enter a student ID to delete.", "error");
            return;
        }

        try {
            const client = window.VinayakAuth.getClient();
            const { error } = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .delete()
                .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId);

            if (error) {
                throw error;
            }

            document.getElementById("deleteStudentForm").reset();
            if (document.getElementById("editStudentId").value.trim() === studentId) {
                clearEditForm();
            }
            setPanelMessage("Student deleted successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Delete student failed", error);
            setPanelMessage(error.message || "Could not delete student.", "error");
        }
    }

    function bindRowActions() {
        const tbody = document.getElementById("studentsTableBody");
        if (!tbody) {
            return;
        }

        tbody.addEventListener("click", function (event) {
            const button = event.target.closest("[data-edit-student]");
            if (!button) {
                return;
            }

            const studentId = button.getAttribute("data-edit-student");
            const student = studentsCache.find(function (item) {
                return getIdentifier(item) === studentId;
            });

            if (!student) {
                return;
            }

            fillEditForm(student);
            const editCard = document.getElementById("editStudentCard");
            if (editCard) {
                editCard.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    function bindSearch() {
        const searchField = document.getElementById("studentSearchInput");
        if (!searchField) {
            return;
        }

        searchField.addEventListener("input", applyStudentFilter);
    }

    function bindStatusDefaults() {
        ["new", "edit"].forEach(function (prefix) {
            const statusField = document.getElementById(prefix + "FeesStatus");
            const dueDateField = document.getElementById(prefix + "DueDate");
            if (!statusField || !dueDateField) {
                return;
            }

            statusField.addEventListener("change", function () {
                if (window.VinayakAuth.normalizeFeesStatus(statusField.value) === "paid" && !dueDateField.value) {
                    dueDateField.value = "";
                }
            });
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await window.VinayakAuth.initProtectedPage({ adminOnly: true });

            const addForm = document.getElementById("addStudentForm");
            const editForm = document.getElementById("editStudentForm");
            const deleteForm = document.getElementById("deleteStudentForm");
            const clearEditButton = document.getElementById("clearEditStudentBtn");

            if (addForm) {
                addForm.addEventListener("submit", addStudent);
            }

            if (editForm) {
                editForm.addEventListener("submit", updateStudent);
            }

            if (deleteForm) {
                deleteForm.addEventListener("submit", deleteStudent);
            }

            if (clearEditButton) {
                clearEditButton.addEventListener("click", clearEditForm);
            }

            bindSearch();
            bindRowActions();
            bindStatusDefaults();
            clearEditForm();
            await refreshStudents();
        } catch (error) {
            console.error("Admin panel init failed", error);
            setPanelMessage(error.message || "Admin panel could not load.", "error");
        }
    });
}());
