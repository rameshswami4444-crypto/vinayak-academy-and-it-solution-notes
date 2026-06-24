(function () {
    async function fetchStudents() {
        const client = window.VinayakAuth.getClient();
        const { data, error } = await client
            .from(window.VinayakAuth.getStudentsTableName())
            .select("id, course, password")
            .order("id", { ascending: true });

        if (error) {
            throw error;
        }

        return data || [];
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

    function renderStudents(students) {
        const tbody = document.getElementById("studentsTableBody");
        if (!tbody) {
            return;
        }

        tbody.innerHTML = "";

        if (!students.length) {
            const row = document.createElement("tr");
            row.innerHTML = '<td colspan="3" class="admin-empty">No students found in Supabase.</td>';
            tbody.appendChild(row);
            return;
        }

        students.forEach(function (student) {
            const courses = window.VinayakAuth.normalizeCourseValue(student.course);
            const row = document.createElement("tr");
            row.innerHTML = [
                "<td>" + (student.id || "-") + "</td>",
                "<td>" + (courses.length ? courses.join(", ") : "-") + "</td>",
                "<td>" + (student.password ? "Saved" : "-") + "</td>"
            ].join("");
            tbody.appendChild(row);
        });
    }

    function getSelectedCourses() {
        return Array.prototype.slice.call(document.querySelectorAll('input[name="studentCourses"]:checked'))
            .map(function (field) {
                return field.value;
            });
    }

    async function refreshStudents() {
        const students = await fetchStudents();
        renderStudents(students);
    }

    async function insertStudentRecord(student) {
        const client = window.VinayakAuth.getClient();
        let result = await client
            .from(window.VinayakAuth.getStudentsTableName())
            .insert([student]);

        if (!result.error) {
            return result;
        }

        if (Array.isArray(student.course)) {
            result = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .insert([
                    Object.assign({}, student, {
                        course: student.course.join(", ")
                    })
                ]);
        }

        return result;
    }

    async function addStudent(event) {
        event.preventDefault();
        clearPanelMessage();

        const studentId = document.getElementById("newStudentId").value.trim();
        const studentPassword = document.getElementById("newStudentPassword").value.trim();
        const selectedCourses = getSelectedCourses();

        if (!studentId || !studentPassword || !selectedCourses.length) {
            setPanelMessage("Fill student ID, password, and select at least one course before saving.", "error");
            return;
        }

        try {
            const { error } = await insertStudentRecord({
                id: studentId,
                password: studentPassword,
                course: selectedCourses
            });

            if (error) {
                throw error;
            }

            document.getElementById("addStudentForm").reset();
            setPanelMessage("Student added successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Add student failed", error);
            setPanelMessage(error.message || "Could not add student.", "error");
        }
    }

    async function updateStudentPassword(event) {
        event.preventDefault();
        clearPanelMessage();

        const studentId = document.getElementById("updateStudentId").value.trim();
        const newPassword = document.getElementById("updateStudentPassword").value.trim();

        if (!studentId || !newPassword) {
            setPanelMessage("Enter student ID and new password.", "error");
            return;
        }

        try {
            const client = window.VinayakAuth.getClient();
            const { error } = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .update({ password: newPassword })
                .eq("id", studentId);

            if (error) {
                throw error;
            }

            document.getElementById("updateStudentPasswordForm").reset();
            setPanelMessage("Student password updated successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Password update failed", error);
            setPanelMessage(error.message || "Could not update password.", "error");
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
                .eq("id", studentId);

            if (error) {
                throw error;
            }

            document.getElementById("deleteStudentForm").reset();
            setPanelMessage("Student deleted successfully.", "success");
            await refreshStudents();
        } catch (error) {
            console.error("Delete student failed", error);
            setPanelMessage(error.message || "Could not delete student.", "error");
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await window.VinayakAuth.initProtectedPage({ adminOnly: true });
            const addForm = document.getElementById("addStudentForm");
            const updateForm = document.getElementById("updateStudentPasswordForm");
            const deleteForm = document.getElementById("deleteStudentForm");

            if (addForm) {
                addForm.addEventListener("submit", addStudent);
            }

            if (updateForm) {
                updateForm.addEventListener("submit", updateStudentPassword);
            }

            if (deleteForm) {
                deleteForm.addEventListener("submit", deleteStudent);
            }

            await refreshStudents();
        } catch (error) {
            console.error("Admin panel init failed", error);
            setPanelMessage(error.message || "Admin panel could not load.", "error");
        }
    });
}());
