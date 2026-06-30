(function () {
    window.__vinayakAdminLoadedAt = new Date().toISOString();
    const COURSES = ["ECCE", "ADFA", "DCFA", "EXCEL", "RS-CIT", "CCC"];
    let studentsCache = [];
    let feesCache = [];
    let emisCache = [];
    let paymentsCache = [];
    let coursesCache = [];
    let batchesCache = [];
    let bulkRows = [];
    let emiMode = "auto";
    const BULK_COLUMNS = [
        "Student ID", "Password", "Student Name", "Father Name", "Mobile", "Alternate Mobile", "Email", "Address", "Course", "Batch", "Admission Date", "Course Duration", "Total Fee", "Advance Fee", "Remaining Fee", "Number of EMI", "First EMI Due Date"
    ];

    function getIdentifier(student) {
        return student[window.VinayakAuth.getStudentIdentifierColumn()] || student.id || "";
    }

    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function getValue(id) {
        const field = document.getElementById(id);
        return field ? field.value.trim() : "";
    }

    function setValue(id, value) {
        const field = document.getElementById(id);
        if (field) {
            field.value = value == null ? "" : value;
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = String(value);
        }
    }

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function normalizeKey(value) {
        return String(value || "").trim().toLowerCase();
    }

    function money(value) {
        return "Rs. " + toNumber(value).toFixed(2);
    }

    function normalizeStatus(value) {
        const status = String(value || "active").trim().toLowerCase();
        return ["active", "blocked", "disabled"].includes(status) ? status : "active";
    }

    function normalizeEmiStatus(value) {
        const status = String(value || "pending").trim().toLowerCase();
        return ["pending", "paid", "overdue"].includes(status) ? status : "pending";
    }

    function getTodayDateString() {
        const today = new Date();
        return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    }

    function addMonths(dateString, months) {
        const date = new Date(dateString + "T00:00:00");
        date.setMonth(date.getMonth() + months);
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    }

    function showAdminSection(sectionName) {
        document.querySelectorAll("[data-admin-section]").forEach(function (section) {
            section.classList.toggle("active", section.getAttribute("data-admin-section") === sectionName);
        });
        document.querySelectorAll("[data-admin-section-target]").forEach(function (button) {
            button.classList.toggle("active", button.getAttribute("data-admin-section-target") === sectionName);
        });
        document.body.classList.remove("admin-sidebar-open");
    }

    function setPanelMessage(message, type) {
        const box = document.getElementById("adminPanelMessage");
        if (!box) {
            window.alert(message);
            return;
        }
        box.hidden = false;
        box.textContent = message;
        box.className = "auth-message " + (type || "success");
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearPanelMessage() {
        const box = document.getElementById("adminPanelMessage");
        if (box) {
            box.hidden = true;
            box.textContent = "";
            box.className = "auth-message";
        }
    }

    async function fetchStudents() {
        const { data, error } = await window.VinayakAuth.getClient()
            .from(window.VinayakAuth.getStudentsTableName())
            .select("*")
            .order(window.VinayakAuth.getStudentIdentifierColumn(), { ascending: false });
        if (error) {
            throw error;
        }
        return (data || []).map(function (student) {
            return Object.assign({}, student, {
                course: window.VinayakAuth.normalizeSingleCourse(student.course),
                batch: student.batch || "",
                account_status: normalizeStatus(student.account_status || (student.fees_status === "due" ? "blocked" : "active")),
                fees_status: window.VinayakAuth.normalizeFeesStatus(student.fees_status),
                due_date: window.VinayakAuth.normalizeDateValue(student.due_date),
                payment_note: student.payment_note || ""
            });
        });
    }

    async function fetchTable(tableName) {
        const { data, error } = await window.VinayakAuth.getClient().from(tableName).select("*");
        if (error) {
            throw error;
        }
        return data || [];
    }

    async function fetchOptionalTable(tableName) {
        try {
            return await fetchTable(tableName);
        } catch (error) {
            console.warn("Optional table fetch failed", tableName, error);
            return [];
        }
    }

    function getStudentFees(studentId) {
        return feesCache.find(function (fee) {
            return String(fee.student_id || fee.studentId || "") === String(studentId);
        }) || {};
    }

    function getStudentEmis(studentId) {
        return emisCache
            .filter(function (emi) {
                return String(emi.student_id || emi.studentId || "") === String(studentId);
            })
            .sort(function (a, b) {
                return Number(a.emi_number || 0) - Number(b.emi_number || 0);
            });
    }

    function getStudentPayments(studentId) {
        return paymentsCache
            .filter(function (payment) {
                return String(payment.student_id || payment.studentId || "") === String(studentId);
            })
            .sort(function (a, b) {
                return String(b.payment_date || b.created_at || "").localeCompare(String(a.payment_date || a.created_at || ""));
            });
    }

    function getStudentById(studentId) {
        return studentsCache.find(function (student) {
            return String(getIdentifier(student)) === String(studentId);
        });
    }

    function updateRemainingFee() {
        const totalFee = toNumber(getValue("newTotalFee"));
        const admissionFee = toNumber(getValue("newAdmissionFee"));
        const remaining = Math.max(totalFee - admissionFee, 0);
        setValue("newRemainingFee", remaining.toFixed(2));
        setValue("autoRemainingFee", remaining.toFixed(2));
    }

    function generateStudentId() {
        const stamp = new Date();
        return "VA" + String(stamp.getFullYear()).slice(2) + String(stamp.getMonth() + 1).padStart(2, "0") + String(stamp.getDate()).padStart(2, "0") + String(Math.floor(Math.random() * 900) + 100);
    }

    function validateMobile(value, required) {
        if (!value && !required) {
            return true;
        }
        return /^[6-9]\d{9}$/.test(value);
    }

    function buildAutoEmis() {
        const remaining = toNumber(getValue("newRemainingFee"));
        const count = Math.max(1, Math.floor(toNumber(getValue("autoEmiCount"))));
        const firstDueDate = getValue("autoFirstDueDate");
        if (remaining <= 0) {
            return [];
        }
        if (!firstDueDate) {
            throw new Error("Select the first EMI due date.");
        }
        const baseAmount = Math.floor((remaining / count) * 100) / 100;
        let allocated = 0;
        return Array.from({ length: count }, function (_, index) {
            const amount = index === count - 1 ? Number((remaining - allocated).toFixed(2)) : baseAmount;
            allocated += amount;
            return { emi_number: index + 1, amount: amount, due_date: addMonths(firstDueDate, index), status: "pending" };
        });
    }

    function readManualEmis() {
        const rows = Array.from(document.querySelectorAll("#admissionEmiBody tr"));
        return rows.filter(function (row) {
            return row.querySelector("[data-emi-number]");
        }).map(function (row) {
            return {
                emi_number: Math.floor(toNumber(row.querySelector("[data-emi-number]").value)),
                amount: toNumber(row.querySelector("[data-emi-amount]").value),
                due_date: row.querySelector("[data-emi-date]").value,
                status: normalizeEmiStatus(row.querySelector("[data-emi-status]").value)
            };
        }).filter(function (emi) {
            return emi.emi_number && emi.amount > 0 && emi.due_date;
        });
    }

    function renderAdmissionEmis(emis, editable) {
        const tbody = document.getElementById("admissionEmiBody");
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        if (!emis.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No EMI rows yet.</td></tr>';
            return;
        }
        emis.forEach(function (emi) {
            const row = document.createElement("tr");
            if (editable) {
                row.innerHTML = [
                    '<td><input data-emi-number type="number" min="1" value="', escapeHtml(emi.emi_number), '"></td>',
                    '<td><input data-emi-amount type="number" min="0" step="0.01" value="', escapeHtml(emi.amount), '"></td>',
                    '<td><input data-emi-date type="date" value="', escapeHtml(emi.due_date), '"></td>',
                    '<td><select data-emi-status><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></td>',
                    '<td><button type="button" class="table-action-btn" data-remove-emi>Remove</button></td>'
                ].join("");
                row.querySelector("[data-emi-status]").value = emi.status;
            } else {
                row.innerHTML = "<td>" + escapeHtml(emi.emi_number) + "</td><td>" + money(emi.amount) + "</td><td>" + escapeHtml(emi.due_date) + "</td><td><span class=\"status-badge status-due\">" + escapeHtml(emi.status) + "</span></td><td>-</td>";
            }
            tbody.appendChild(row);
        });
    }

    function validateAdmission(studentId, mobile, alternateMobile, totalFee, admissionFee, remainingFee, emis) {
        if (!studentId || !getValue("newStudentName") || !getValue("newFatherName") || !mobile || !getValue("newStudentCourse") || !getValue("newBatch") || !getValue("newAdmissionDate") || !getValue("newCourseDuration") || !getValue("newStudentPassword")) {
            throw new Error("Fill all required admission fields.");
        }
        if (!validateMobile(mobile, true) || !validateMobile(alternateMobile, false)) {
            throw new Error("Enter a valid 10 digit Indian mobile number.");
        }
        if (totalFee <= 0 || admissionFee < 0 || admissionFee > totalFee) {
            throw new Error("Enter valid fee amounts.");
        }
        const emiTotal = emis.reduce(function (sum, emi) {
            return sum + toNumber(emi.amount);
        }, 0);
        if (emiTotal > remainingFee + 0.01) {
            throw new Error("EMI total cannot exceed remaining fee.");
        }
        if (remainingFee > 0 && Math.abs(emiTotal - remainingFee) > 0.01) {
            throw new Error("EMI total must match remaining fee.");
        }
    }

    async function addStudent(event) {
        event.preventDefault();
        clearPanelMessage();
        console.group("Admission submit");
        console.log("Submit event received", {
            eventType: event.type,
            submitter: event.submitter ? event.submitter.textContent.trim() : "",
            viewportWidth: window.innerWidth,
            emiMode: emiMode,
            scriptLoadedAt: window.__vinayakAdminLoadedAt
        });

        try {
            updateRemainingFee();
            console.log("Fee values recalculated");

            const studentId = getValue("newStudentId");
            const totalFee = toNumber(getValue("newTotalFee"));
            const admissionFee = toNumber(getValue("newAdmissionFee"));
            const remainingFee = toNumber(getValue("newRemainingFee"));
            console.log("Admission values", {
                studentId: studentId,
                course: getValue("newStudentCourse"),
                batch: getValue("newBatch"),
                totalFee: totalFee,
                admissionFee: admissionFee,
                remainingFee: remainingFee,
                firstDueDate: getValue("autoFirstDueDate")
            });

            const emis = emiMode === "auto" ? buildAutoEmis() : readManualEmis();
            console.log("EMI rows prepared", emis);

            validateAdmission(studentId, getValue("newMobile"), getValue("newAlternateMobile"), totalFee, admissionFee, remainingFee, emis);
            console.log("Admission validation passed");

            const client = window.VinayakAuth.getClient();
            console.log("Checking duplicate student ID");
            const { data: existing, error: existingError } = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .select(window.VinayakAuth.getStudentIdentifierColumn())
                .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId)
                .limit(1);
            if (existingError) {
                throw existingError;
            }
            if (existing && existing.length) {
                throw new Error("Student ID already exists.");
            }

            const firstDue = emis.length ? emis[0].due_date : null;
            const studentPayload = {
                id: studentId,
                password: getValue("newStudentPassword"),
                name: getValue("newStudentName"),
                father_name: getValue("newFatherName"),
                mobile: getValue("newMobile"),
                alternate_mobile: getValue("newAlternateMobile") || null,
                email: getValue("newEmail") || null,
                address: getValue("newAddress"),
                course: window.VinayakAuth.normalizeSingleCourse(getValue("newStudentCourse")),
                batch: getValue("newBatch"),
                admission_date: getValue("newAdmissionDate"),
                course_duration: getValue("newCourseDuration"),
                account_status: normalizeStatus(getValue("newAccountStatus")),
                fees_status: normalizeStatus(getValue("newAccountStatus")) === "active" ? "paid" : "due",
                due_date: firstDue,
                payment_note: remainingFee > 0 ? "EMI schedule created" : "Fee paid in full"
            };

            console.log("Inserting student", studentPayload);
            const { error: studentError } = await client.from(window.VinayakAuth.getStudentsTableName()).insert([studentPayload]);
            if (studentError) {
                throw studentError;
            }
            console.log("Student inserted successfully");

            const feePayload = {
                student_id: studentId,
                total_fee: totalFee,
                admission_fee: admissionFee,
                remaining_fee: remainingFee,
                paid_amount: admissionFee,
                status: remainingFee > 0 ? "pending" : "paid"
            };
            console.log("Inserting student fee", feePayload);
            const { error: feeError } = await client.from("student_fees").insert([feePayload]);
            if (feeError) {
                throw feeError;
            }
            console.log("Student fee inserted successfully");

            if (emis.length) {
                const emiPayload = emis.map(function (emi) {
                    return Object.assign({}, emi, {
                        student_id: studentId,
                        paid_date: emi.status === "paid" ? getTodayDateString() : null
                    });
                });
                console.log("Inserting EMI schedule", emiPayload);
                const { error: emiError } = await client.from("emis").insert(emiPayload);
                if (emiError) {
                    throw emiError;
                }
                console.log("EMI schedule inserted successfully");
            }

            document.getElementById("addStudentForm").reset();
            setupAdmissionDefaults();
            setPanelMessage("Admission completed and EMI schedule created.", "success");
            await refreshAll();
            console.log("Admin data refreshed after admission");
            showAdminSection("students");
        } catch (error) {
            console.error("Admission failed", error);
            setPanelMessage((error && error.message ? error.message : "Could not complete admission.") + " Check browser console for detailed admission logs.", "error");
        } finally {
            console.groupEnd();
        }
    }

    function renderStudents(students) {
        const tbody = document.getElementById("studentsTableBody");
        if (!tbody) {
            return;
        }
        tbody.innerHTML = "";
        if (!students.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">No students found.</td></tr>';
            return;
        }
        students.forEach(function (student) {
            const id = getIdentifier(student);
            const row = document.createElement("tr");
            row.innerHTML = [
                "<td>", escapeHtml(id), "</td><td>", escapeHtml(student.name || "-"), "</td><td>", escapeHtml(student.mobile || "-"),
                "</td><td>", escapeHtml(student.course || "-"), "</td><td>", escapeHtml(student.batch || "-"), "</td>",
                '<td><span class="status-badge ', student.account_status === "active" ? "status-paid" : "status-due", '">', escapeHtml(student.account_status), "</span></td>",
                '<td><div class="erp-row-actions">',
                '<button type="button" class="table-action-btn" data-view-student="', escapeHtml(id), '">View</button>',
                '<button type="button" class="table-action-btn" data-edit-student="', escapeHtml(id), '">Edit</button>',
                '<button type="button" class="table-action-btn" data-disable-student="', escapeHtml(id), '">Disable</button>',
                "</div></td>"
            ].join("");
            tbody.appendChild(row);
        });
    }

    function updateBatchFilter() {
        const filter = document.getElementById("studentBatchFilter");
        if (!filter) {
            return;
        }
        const current = filter.value;
        const batches = studentsCache.map(function (student) {
            return student.batch;
        }).filter(Boolean).filter(function (batch, index, all) {
            return all.indexOf(batch) === index;
        }).sort();
        filter.innerHTML = '<option value="">All</option>' + batches.map(function (batch) {
            return '<option value="' + escapeHtml(batch) + '">' + escapeHtml(batch) + "</option>";
        }).join("");
        filter.value = current;
    }

    function applyStudentFilter() {
        const query = getValue("studentSearchInput").toLowerCase();
        const course = getValue("studentCourseFilter");
        const batch = getValue("studentBatchFilter");
        const status = getValue("studentStatusFilter");
        renderStudents(studentsCache.filter(function (student) {
            const matchesQuery = !query || [getIdentifier(student), student.name, student.father_name, student.mobile, student.course, student.batch].some(function (value) {
                return String(value || "").toLowerCase().includes(query);
            });
            return matchesQuery && (!course || student.course === course) && (!batch || student.batch === batch) && (!status || student.account_status === status);
        }));
    }

    function getDashboardStudents() {
        const course = getValue("dashboardCourseFilter");
        return course ? studentsCache.filter(function (student) { return student.course === course; }) : studentsCache;
    }

    function renderList(targetId, items, emptyMessage, renderItem) {
        const target = document.getElementById(targetId);
        if (!target) {
            return;
        }
        target.innerHTML = items.length ? items.map(renderItem).join("") : '<div class="erp-empty">' + escapeHtml(emptyMessage) + "</div>";
    }

    function renderDashboard() {
        const students = getDashboardStudents();
        const studentIds = students.map(getIdentifier);
        const today = getTodayDateString();
        const active = students.filter(function (student) { return student.account_status === "active"; });
        const blocked = students.filter(function (student) { return student.account_status !== "active"; });
        const scopedEmis = emisCache.filter(function (emi) { return studentIds.includes(String(emi.student_id || "")); });
        const todayDue = scopedEmis.filter(function (emi) { return normalizeEmiStatus(emi.status) !== "paid" && window.VinayakAuth.normalizeDateValue(emi.due_date) === today; });
        const dueStudentIds = scopedEmis.filter(function (emi) { return normalizeEmiStatus(emi.status) !== "paid"; }).map(function (emi) { return String(emi.student_id); });

        setText("statTotalStudents", students.length);
        setText("statActiveStudents", active.length);
        setText("statBlockedStudents", blocked.length);
        setText("statTodayDue", todayDue.length);

        renderList("recentStudentsList", students.slice(0, 5), "No admissions yet.", function (student) {
            return '<div class="erp-list-item"><span><strong>' + escapeHtml(student.name || getIdentifier(student)) + '</strong><small>' + escapeHtml(student.admission_date || student.course || "-") + '</small></span><span>' + escapeHtml(student.course || "-") + "</span></div>";
        });
        renderList("dueEmiStudentsList", students.filter(function (student) { return dueStudentIds.includes(getIdentifier(student)); }).slice(0, 5), "No due EMI students.", function (student) {
            return '<div class="erp-list-item"><span><strong>' + escapeHtml(student.name || getIdentifier(student)) + '</strong><small>' + escapeHtml(getIdentifier(student)) + '</small></span><span class="status-badge status-due">Due</span></div>';
        });
        renderList("pendingEmiList", scopedEmis.filter(function (emi) { return normalizeEmiStatus(emi.status) === "pending"; }).slice(0, 5), "No pending EMIs.", function (emi) {
            return '<div class="erp-list-item"><span><strong>' + escapeHtml(emi.student_id) + ' - EMI ' + escapeHtml(emi.emi_number) + '</strong><small>' + escapeHtml(emi.due_date || "-") + '</small></span><span>' + money(emi.amount) + "</span></div>";
        });
        renderList("todayDueList", todayDue, "No EMIs due today.", function (emi) {
            return '<div class="erp-list-item"><span><strong>' + escapeHtml(emi.student_id) + ' - EMI ' + escapeHtml(emi.emi_number) + '</strong><small>' + escapeHtml(emi.due_date || "-") + '</small></span><span>' + money(emi.amount) + "</span></div>";
        });
    }

    function fillEditForm(student) {
        if (!student) {
            setPanelMessage("Student record not found.", "error");
            return;
        }
        const studentId = getIdentifier(student);
        const fees = getStudentFees(studentId);
        const emis = getStudentEmis(studentId);
        const upcoming = emis.filter(function (emi) { return normalizeEmiStatus(emi.status) !== "paid"; })[0];
        const form = document.getElementById("editStudentForm");
        if (form) {
            form.dataset.originalStudentId = studentId;
        }
        setValue("editStudentId", getIdentifier(student));
        setValue("editStudentName", student.name || "");
        setValue("editFatherName", student.father_name || "");
        setValue("editMobile", student.mobile || "");
        setValue("editAlternateMobile", student.alternate_mobile || "");
        setValue("editEmail", student.email || "");
        setValue("editStudentPassword", student.password || "");
        setValue("editStudentCourse", student.course || "");
        setValue("editBatch", student.batch || "");
        setValue("editAdmissionDate", student.admission_date || "");
        setValue("editCourseDuration", student.course_duration || "");
        setValue("editAccountStatus", student.account_status || "active");
        setValue("editFeesStatus", fees.status || student.fees_status || "pending");
        setValue("editTotalFee", fees.total_fee || "");
        setValue("editAdvanceFee", fees.admission_fee || fees.paid_amount || "");
        setValue("editRemainingFee", fees.remaining_fee || "");
        setValue("editDueDate", student.due_date || (upcoming && upcoming.due_date) || "");
        setValue("editAddress", student.address || "");
        setValue("editPaymentNote", student.payment_note || "");
        renderEditEmis(studentId);
    }

    function clearEditForm() {
        const form = document.getElementById("editStudentForm");
        if (form) {
            form.reset();
            delete form.dataset.originalStudentId;
        }
        setValue("editAccountStatus", "active");
        setValue("editFeesStatus", "pending");
        renderEditEmis("");
    }

    function renderEditEmis(studentId) {
        const tbody = document.getElementById("editEmiTableBody");
        if (!tbody) {
            return;
        }
        if (!studentId) {
            tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Select a student to edit EMI schedule.</td></tr>';
            return;
        }
        const rows = getStudentEmis(studentId);
        tbody.innerHTML = rows.length ? rows.map(function (emi) {
            const key = escapeHtml(emi.id || emi.emi_number);
            return [
                '<tr data-edit-emi-row data-emi-key="', key, '" data-student-id="', escapeHtml(studentId), '">',
                '<td><input type="number" min="1" data-edit-emi-number value="', escapeHtml(emi.emi_number), '"></td>',
                '<td><input type="number" min="0" step="0.01" data-edit-emi-amount value="', escapeHtml(emi.amount), '"></td>',
                '<td><input type="date" data-edit-emi-due value="', escapeHtml(emi.due_date || ""), '"></td>',
                '<td><select data-edit-emi-status><option value="pending"', normalizeEmiStatus(emi.status) === "pending" ? " selected" : "", '>Pending</option><option value="paid"', normalizeEmiStatus(emi.status) === "paid" ? " selected" : "", '>Paid</option><option value="overdue"', normalizeEmiStatus(emi.status) === "overdue" ? " selected" : "", '>Overdue</option></select></td>',
                '<td><input type="date" data-edit-emi-paid value="', escapeHtml(emi.paid_date || ""), '"></td>',
                '<td><button type="button" class="table-action-btn danger-btn" data-delete-edit-emi="', key, '" data-delete-emi-student="', escapeHtml(studentId), '">Delete</button></td>',
                '</tr>'
            ].join("");
        }).join("") : '<tr><td colspan="6" class="admin-empty">No EMI records. Use Add EMI to create one.</td></tr>';
    }

    function getCurrentEditStudentId() {
        const form = document.getElementById("editStudentForm");
        return getValue("editStudentId") || (form && form.dataset.originalStudentId) || "";
    }

    async function addEditEmi() {
        const studentId = getCurrentEditStudentId();
        if (!studentId) {
            setPanelMessage("Select a student before adding EMI.", "error");
            return;
        }
        const rows = getStudentEmis(studentId);
        const payload = {
            student_id: studentId,
            emi_number: rows.length ? Math.max.apply(null, rows.map(function (emi) { return Number(emi.emi_number || 0); })) + 1 : 1,
            amount: 0,
            due_date: getTodayDateString(),
            status: "pending",
            paid_date: null
        };
        const { error } = await window.VinayakAuth.getClient().from("emis").insert([payload]);
        if (error) {
            setPanelMessage(error.message || "Could not add EMI.", "error");
            return;
        }
        setPanelMessage("EMI added.", "success");
        await refreshAll();
        renderEditEmis(studentId);
    }

    function getEditedEmiPayload(row) {
        const status = normalizeEmiStatus(row.querySelector("[data-edit-emi-status]").value);
        return {
            emi_number: Number(row.querySelector("[data-edit-emi-number]").value || 0),
            amount: toNumber(row.querySelector("[data-edit-emi-amount]").value),
            due_date: row.querySelector("[data-edit-emi-due]").value || null,
            status: status,
            paid_date: status === "paid" ? (row.querySelector("[data-edit-emi-paid]").value || getTodayDateString()) : (row.querySelector("[data-edit-emi-paid]").value || null)
        };
    }

    async function updateEditEmi(row) {
        const studentId = row.getAttribute("data-student-id");
        const key = row.getAttribute("data-emi-key");
        const emi = emisCache.find(function (item) {
            return String(item.student_id) === String(studentId) && (String(item.id || "") === String(key) || String(item.emi_number) === String(key));
        });
        if (!emi) {
            setPanelMessage("EMI record not found.", "error");
            return;
        }
        const payload = getEditedEmiPayload(row);
        const query = window.VinayakAuth.getClient().from("emis").update(payload);
        const result = emi.id ? await query.eq("id", emi.id) : await query.eq("student_id", studentId).eq("emi_number", emi.emi_number);
        if (result.error) {
            setPanelMessage(result.error.message || "Could not update EMI.", "error");
            return;
        }
        await syncStudentLock(studentId);
        setPanelMessage("EMI updated.", "success");
        await refreshAll();
        renderEditEmis(studentId);
    }

    async function deleteEditEmi(studentId, emiKey) {
        if (!window.confirm("Delete this EMI record?")) {
            return;
        }
        const emi = emisCache.find(function (item) {
            return String(item.student_id) === String(studentId) && (String(item.id || "") === String(emiKey) || String(item.emi_number) === String(emiKey));
        });
        if (!emi) {
            setPanelMessage("EMI record not found.", "error");
            return;
        }
        const query = window.VinayakAuth.getClient().from("emis").delete();
        const result = emi.id ? await query.eq("id", emi.id) : await query.eq("student_id", studentId).eq("emi_number", emi.emi_number);
        if (result.error) {
            setPanelMessage(result.error.message || "Could not delete EMI.", "error");
            return;
        }
        await syncStudentLock(studentId);
        setPanelMessage("EMI deleted.", "success");
        await refreshAll();
        renderEditEmis(studentId);
    }

    async function updateStudent(event) {
        event.preventDefault();
        clearPanelMessage();
        const form = document.getElementById("editStudentForm");
        const originalStudentId = (form && form.dataset.originalStudentId) || getValue("editStudentId");
        const studentId = getValue("editStudentId");
        if (!studentId || !getValue("editStudentName") || !validateMobile(getValue("editMobile"), true) || !validateMobile(getValue("editAlternateMobile"), false)) {
            setPanelMessage("Student ID, name, and valid mobile are required.", "error");
            return;
        }
        try {
            const client = window.VinayakAuth.getClient();
            const status = normalizeStatus(getValue("editAccountStatus"));
            const feesStatus = getValue("editFeesStatus") || (status === "active" ? "paid" : "due");
            const payload = {
                id: studentId,
                name: getValue("editStudentName"),
                father_name: getValue("editFatherName") || null,
                mobile: getValue("editMobile"),
                alternate_mobile: getValue("editAlternateMobile") || null,
                email: getValue("editEmail") || null,
                password: getValue("editStudentPassword"),
                course: window.VinayakAuth.normalizeSingleCourse(getValue("editStudentCourse")),
                batch: getValue("editBatch"),
                admission_date: getValue("editAdmissionDate") || null,
                course_duration: getValue("editCourseDuration") || null,
                account_status: status,
                fees_status: feesStatus === "paid" ? "paid" : "due",
                due_date: getValue("editDueDate") || null,
                address: getValue("editAddress") || null,
                payment_note: getValue("editPaymentNote") || null
            };
            const { error } = await client
                .from(window.VinayakAuth.getStudentsTableName())
                .update(payload)
                .eq(window.VinayakAuth.getStudentIdentifierColumn(), originalStudentId);
            if (error) {
                throw error;
            }
            if (studentId !== originalStudentId) {
                const feeIdResult = await client.from("student_fees").update({ student_id: studentId }).eq("student_id", originalStudentId);
                if (feeIdResult.error) throw feeIdResult.error;
                const emiIdResult = await client.from("emis").update({ student_id: studentId }).eq("student_id", originalStudentId);
                if (emiIdResult.error) throw emiIdResult.error;
                const paymentIdResult = await client.from("payments").update({ student_id: studentId }).eq("student_id", originalStudentId);
                if (paymentIdResult.error) console.warn("Payment student ID sync skipped", paymentIdResult.error);
            }
            const feePayload = {
                student_id: studentId,
                total_fee: toNumber(getValue("editTotalFee")),
                admission_fee: toNumber(getValue("editAdvanceFee")),
                paid_amount: toNumber(getValue("editAdvanceFee")),
                remaining_fee: toNumber(getValue("editRemainingFee")),
                status: feesStatus
            };
            const existingFee = getStudentFees(originalStudentId) || getStudentFees(studentId);
            const feeResult = existingFee.student_id
                ? await client.from("student_fees").update(feePayload).eq("student_id", studentId)
                : await client.from("student_fees").insert([feePayload]);
            if (feeResult.error) {
                throw feeResult.error;
            }
            if (form) {
                form.dataset.originalStudentId = studentId;
            }
            setPanelMessage("Student details updated.", "success");
            await refreshAll();
            renderEditEmis(studentId);
        } catch (error) {
            console.error("Student update failed", error);
            setPanelMessage(error.message || "Could not update student.", "error");
        }
    }

    async function disableStudent(studentId) {
        if (!window.confirm("Disable this student account?")) {
            return;
        }
        const { error } = await window.VinayakAuth.getClient()
            .from(window.VinayakAuth.getStudentsTableName())
            .update({ account_status: "disabled", fees_status: "due", payment_note: "Account disabled by admin" })
            .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId);
        if (error) {
            setPanelMessage(error.message || "Could not disable student.", "error");
            return;
        }
        setPanelMessage("Student disabled.", "success");
        await refreshAll();
    }

    async function deleteStudent(event) {
        event.preventDefault();
        clearPanelMessage();
        const studentId = getValue("deleteStudentId");
        if (!studentId || !window.confirm("Delete student and related fee/EMI records permanently?")) {
            return;
        }
        try {
            const client = window.VinayakAuth.getClient();
            await client.from("emis").delete().eq("student_id", studentId);
            await client.from("student_fees").delete().eq("student_id", studentId);
            const { error } = await client.from(window.VinayakAuth.getStudentsTableName()).delete().eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId);
            if (error) {
                throw error;
            }
            document.getElementById("deleteStudentForm").reset();
            clearEditForm();
            setPanelMessage("Student deleted.", "success");
            await refreshAll();
        } catch (error) {
            console.error("Delete student failed", error);
            setPanelMessage(error.message || "Could not delete student.", "error");
        }
    }

    function renderProfile(studentId) {
        const student = getStudentById(studentId);
        if (!student) {
            return;
        }
        const fees = getStudentFees(studentId);
        const emis = getStudentEmis(studentId);
        const payments = getStudentPayments(studentId);
        const overdue = emis.filter(function (emi) { return normalizeEmiStatus(emi.status) === "overdue"; });
        const upcoming = emis.filter(function (emi) { return normalizeEmiStatus(emi.status) !== "paid"; })[0];
        const profile = document.getElementById("studentProfileCard");
        const body = document.getElementById("studentProfileBody");
        body.innerHTML = [
            profileBlock("Personal Details", [["Student ID", studentId], ["Name", student.name], ["Father Name", student.father_name], ["Mobile", student.mobile], ["Alternate Mobile", student.alternate_mobile], ["Email", student.email], ["Address", student.address]]),
            profileBlock("Course", [["Course", student.course], ["Batch", student.batch], ["Admission Date", student.admission_date], ["Duration", student.course_duration]]),
            profileBlock("Fee Summary", [["Total Fee", money(fees.total_fee)], ["Admission Fee", money(fees.admission_fee)], ["Remaining Fee", money(fees.remaining_fee)], ["Payment Status", fees.status || student.fees_status]]),
            profileBlock("EMI Summary", [["Total EMIs", emis.length], ["Upcoming EMI", upcoming ? "EMI " + upcoming.emi_number + " - " + money(upcoming.amount) + " due " + upcoming.due_date : "-"], ["Overdue EMI", overdue.length], ["Account Status", student.account_status]]),
            profileBlock("Payment History", payments.length ? payments.slice(0, 6).map(function (payment) {
                return [payment.payment_date || payment.created_at || "Payment", money(payment.amount || payment.paid_amount || payment.payment_amount) + " - " + (payment.status || payment.mode || "recorded")];
            }) : [["Payments", "No payment records found"]])
        ].join("");
        profile.hidden = false;
        profile.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function profileBlock(title, rows) {
        return '<article class="profile-panel"><h4>' + escapeHtml(title) + "</h4>" + rows.map(function (row) {
            return "<p><strong>" + escapeHtml(row[0]) + "</strong><span>" + escapeHtml(row[1] == null || row[1] === "" ? "-" : row[1]) + "</span></p>";
        }).join("") + "</article>";
    }

    function renderEmis() {
        const tbody = document.getElementById("emiTableBody");
        if (!tbody) {
            return;
        }
        const query = getValue("emiSearchInput").toLowerCase();
        const rows = emisCache.filter(function (emi) {
            return !query || [emi.student_id, emi.status].some(function (value) {
                return String(value || "").toLowerCase().includes(query);
            });
        });
        tbody.innerHTML = rows.length ? rows.map(function (emi) {
            const status = normalizeEmiStatus(emi.status);
            return [
                "<tr><td>", escapeHtml(emi.student_id), "</td><td>", escapeHtml(emi.emi_number), "</td><td>", money(emi.amount), "</td><td>",
                escapeHtml(emi.due_date || "-"), '</td><td><span class="status-badge ', status === "paid" ? "status-paid" : "status-due", '">', escapeHtml(status),
                "</span></td><td>", escapeHtml(emi.paid_date || "-"), "</td><td>",
                status === "paid" ? "-" : '<button type="button" class="table-action-btn" data-pay-emi="' + escapeHtml(emi.id || emi.emi_number) + '" data-pay-student="' + escapeHtml(emi.student_id) + '">Mark Paid</button>',
                "</td></tr>"
            ].join("");
        }).join("") : '<tr><td colspan="7" class="admin-empty">No EMI records.</td></tr>';
    }

    async function markEmiPaid(studentId, emiKey) {
        const emi = emisCache.find(function (item) {
            return String(item.student_id) === String(studentId) && (String(item.id || "") === String(emiKey) || String(item.emi_number) === String(emiKey));
        });
        if (!emi) {
            return;
        }
        const query = window.VinayakAuth.getClient().from("emis").update({ status: "paid", paid_date: getTodayDateString() });
        const result = emi.id ? await query.eq("id", emi.id) : await query.eq("student_id", studentId).eq("emi_number", emi.emi_number);
        if (result.error) {
            setPanelMessage(result.error.message || "Could not update EMI.", "error");
            return;
        }
        emi.status = "paid";
        emi.paid_date = getTodayDateString();
        await syncStudentLock(studentId);
        setPanelMessage("EMI marked as paid.", "success");
        await refreshAll();
    }

    async function syncStudentLock(studentId) {
        const emis = getStudentEmis(studentId);
        const hasOverdue = emis.some(function (emi) {
            return normalizeEmiStatus(emi.status) === "overdue";
        });
        await window.VinayakAuth.getClient()
            .from(window.VinayakAuth.getStudentsTableName())
            .update({ account_status: hasOverdue ? "blocked" : "active", fees_status: hasOverdue ? "due" : "paid" })
            .eq(window.VinayakAuth.getStudentIdentifierColumn(), studentId);
    }

    function getCourseNames() {
        const names = coursesCache.map(function (course) {
            return course.name || course.course || course.course_name || course.code || course.id;
        }).filter(Boolean);
        return names.length ? names : COURSES;
    }

    function getBatchNames() {
        const fromTable = batchesCache.map(function (batch) {
            return batch.name || batch.batch || batch.batch_name || batch.code || batch.id;
        }).filter(Boolean);
        if (fromTable.length) {
            return fromTable;
        }
        return studentsCache.map(function (student) {
            return student.batch;
        }).filter(Boolean);
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let cell = "";
        let quoted = false;
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            const next = text[index + 1];
            if (char === '"' && quoted && next === '"') {
                cell += '"';
                index += 1;
            } else if (char === '"') {
                quoted = !quoted;
            } else if (char === "," && !quoted) {
                row.push(cell);
                cell = "";
            } else if ((char === "\n" || char === "\r") && !quoted) {
                if (char === "\r" && next === "\n") {
                    index += 1;
                }
                row.push(cell);
                if (row.some(function (value) { return String(value).trim(); })) {
                    rows.push(row);
                }
                row = [];
                cell = "";
            } else {
                cell += char;
            }
        }
        row.push(cell);
        if (row.some(function (value) { return String(value).trim(); })) {
            rows.push(row);
        }
        return rows;
    }

    function rowsToObjects(rows) {
        const headers = (rows[0] || []).map(function (header) {
            return String(header || "").trim();
        });
        return rows.slice(1).map(function (row, index) {
            const record = { __rowNumber: index + 2 };
            headers.forEach(function (header, columnIndex) {
                record[header] = row[columnIndex] == null ? "" : row[columnIndex];
            });
            return record;
        }).filter(function (record) {
            return BULK_COLUMNS.some(function (column) {
                return String(record[column] || "").trim();
            });
        });
    }

    function readImportFile(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onerror = function () {
                reject(new Error("Could not read import file."));
            };
            reader.onload = function (event) {
                try {
                    const name = file.name.toLowerCase();
                    if (name.endsWith(".csv")) {
                        resolve(rowsToObjects(parseCsv(String(event.target.result || ""))));
                        return;
                    }
                    if (!window.XLSX) {
                        reject(new Error("Excel parser did not load. Refresh and try again, or upload CSV."));
                        return;
                    }
                    const workbook = window.XLSX.read(event.target.result, { type: "array" });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    resolve(window.XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(function (row, index) {
                        row.__rowNumber = index + 2;
                        return row;
                    }));
                } catch (error) {
                    reject(error);
                }
            };
            if (file.name.toLowerCase().endsWith(".csv")) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    function getBulkValue(row, column) {
        return String(row[column] == null ? "" : row[column]).trim();
    }

    function normalizeImportDate(value) {
        if (!value) {
            return "";
        }
        if (typeof value === "number" && window.XLSX && window.XLSX.SSF) {
            const parsed = window.XLSX.SSF.parse_date_code(value);
            if (parsed) {
                return parsed.y + "-" + String(parsed.m).padStart(2, "0") + "-" + String(parsed.d).padStart(2, "0");
            }
        }
        return window.VinayakAuth.normalizeDateValue(value);
    }

    function buildBulkEmis(row) {
        const remaining = toNumber(getBulkValue(row, "Remaining Fee"));
        const count = Math.floor(toNumber(getBulkValue(row, "Number of EMI")));
        const firstDueDate = normalizeImportDate(getBulkValue(row, "First EMI Due Date"));
        if (remaining <= 0) {
            return [];
        }
        if (!count || count < 1 || !firstDueDate) {
            throw new Error("Valid EMI count and first EMI due date are required.");
        }
        const baseAmount = Math.floor((remaining / count) * 100) / 100;
        let allocated = 0;
        return Array.from({ length: count }, function (_, index) {
            const amount = index === count - 1 ? Number((remaining - allocated).toFixed(2)) : baseAmount;
            allocated += amount;
            return { emi_number: index + 1, amount: amount, due_date: addMonths(firstDueDate, index), status: "pending" };
        });
    }

    function validateBulkRows(rawRows) {
        const existingIds = studentsCache.map(function (student) { return normalizeKey(getIdentifier(student)); });
        const existingMobiles = studentsCache.map(function (student) { return normalizeKey(student.mobile); }).filter(Boolean);
        const seenIds = [];
        const seenMobiles = [];
        const courseNames = getCourseNames().map(normalizeKey);
        const batchNames = getBatchNames().map(normalizeKey);

        bulkRows = rawRows.map(function (row) {
            const id = getBulkValue(row, "Student ID");
            const mobile = getBulkValue(row, "Mobile");
            const course = getBulkValue(row, "Course").toUpperCase();
            const batch = getBulkValue(row, "Batch");
            const totalFee = toNumber(getBulkValue(row, "Total Fee"));
            const advanceFee = toNumber(getBulkValue(row, "Advance Fee"));
            const remainingFee = toNumber(getBulkValue(row, "Remaining Fee"));
            const errors = [];

            if (!id || !getBulkValue(row, "Password") || !getBulkValue(row, "Student Name") || !mobile || !course || !batch) errors.push("Missing required fields");
            if (!validateMobile(mobile, true)) errors.push("Invalid mobile");
            if (existingIds.includes(normalizeKey(id)) || seenIds.includes(normalizeKey(id))) errors.push("Duplicate Student ID");
            if (existingMobiles.includes(normalizeKey(mobile)) || seenMobiles.includes(normalizeKey(mobile))) errors.push("Duplicate Mobile");
            if (!courseNames.includes(normalizeKey(course))) errors.push("Course does not exist");
            if (batchNames.length && !batchNames.includes(normalizeKey(batch))) errors.push("Batch does not exist");
            if (totalFee <= 0 || advanceFee < 0 || remainingFee < 0 || Math.abs(totalFee - advanceFee - remainingFee) > 0.01) errors.push("Invalid fee values");
            try { buildBulkEmis(row); } catch (error) { errors.push(error.message); }

            seenIds.push(normalizeKey(id));
            seenMobiles.push(normalizeKey(mobile));
            return { row: row, status: errors.length ? (errors.join(" ").includes("Duplicate") ? "duplicate" : "invalid") : "valid", errors: errors };
        });
        renderBulkRows();
    }

    function renderBulkRows() {
        const tbody = document.getElementById("bulkImportTableBody");
        if (!tbody) return;
        const query = getValue("bulkSearchInput").toLowerCase();
        const rows = bulkRows.filter(function (item) {
            return !query || [getBulkValue(item.row, "Student ID"), getBulkValue(item.row, "Student Name"), getBulkValue(item.row, "Mobile"), item.status, item.errors.join(" ")].some(function (value) {
                return String(value || "").toLowerCase().includes(query);
            });
        });
        tbody.innerHTML = rows.length ? rows.map(function (item) {
            const row = item.row;
            return "<tr><td>" + escapeHtml(row.__rowNumber) + "</td><td>" + escapeHtml(getBulkValue(row, "Student ID")) + "</td><td>" + escapeHtml(getBulkValue(row, "Student Name")) + "</td><td>" + escapeHtml(getBulkValue(row, "Mobile")) + "</td><td>" + escapeHtml(getBulkValue(row, "Course")) + "</td><td>" + escapeHtml(getBulkValue(row, "Batch")) + '</td><td><span class="status-badge ' + (item.status === "valid" ? "status-paid" : "status-due") + '">' + escapeHtml(item.status) + "</span></td><td>" + escapeHtml(item.errors.join("; ") || "Ready") + "</td></tr>";
        }).join("") : '<tr><td colspan="8" class="admin-empty">No import rows loaded.</td></tr>';
        setText("bulkValidCount", bulkRows.filter(function (item) { return item.status === "valid"; }).length);
        setText("bulkDuplicateCount", bulkRows.filter(function (item) { return item.status === "duplicate"; }).length);
        setText("bulkInvalidCount", bulkRows.filter(function (item) { return item.status === "invalid"; }).length);
        setText("bulkFailedCount", bulkRows.filter(function (item) { return item.status === "failed"; }).length);
        document.getElementById("importStudentsBtn").disabled = !bulkRows.some(function (item) { return item.status === "valid"; });
    }

    async function validateBulkImport() {
        clearPanelMessage();
        const file = document.getElementById("bulkImportFile").files[0];
        if (!file) {
            setPanelMessage("Choose a CSV or Excel file first.", "error");
            return;
        }
        try {
            const rows = await readImportFile(file);
            validateBulkRows(rows);
            setPanelMessage("Import file validated. Review the summary before importing.", "success");
        } catch (error) {
            console.error("Bulk validation failed", error);
            setPanelMessage(error.message || "Could not validate import file.", "error");
        }
    }

    function buildBulkPayload(item) {
        const row = item.row;
        const id = getBulkValue(row, "Student ID");
        const course = getBulkValue(row, "Course").toUpperCase();
        const remainingFee = toNumber(getBulkValue(row, "Remaining Fee"));
        const emis = buildBulkEmis(row);
        return {
            student: {
                id: id,
                password: getBulkValue(row, "Password"),
                name: getBulkValue(row, "Student Name"),
                father_name: getBulkValue(row, "Father Name"),
                mobile: getBulkValue(row, "Mobile"),
                alternate_mobile: getBulkValue(row, "Alternate Mobile") || null,
                email: getBulkValue(row, "Email") || null,
                address: getBulkValue(row, "Address"),
                course: course,
                batch: getBulkValue(row, "Batch"),
                admission_date: normalizeImportDate(getBulkValue(row, "Admission Date")),
                course_duration: getBulkValue(row, "Course Duration"),
                account_status: "active",
                fees_status: "paid",
                due_date: emis.length ? emis[0].due_date : null,
                payment_note: remainingFee > 0 ? "Bulk EMI schedule created" : "Fee paid in full"
            },
            fee: {
                student_id: id,
                total_fee: toNumber(getBulkValue(row, "Total Fee")),
                admission_fee: toNumber(getBulkValue(row, "Advance Fee")),
                remaining_fee: remainingFee,
                paid_amount: toNumber(getBulkValue(row, "Advance Fee")),
                status: remainingFee > 0 ? "pending" : "paid"
            },
            emis: emis.map(function (emi) {
                return Object.assign({}, emi, { student_id: id, paid_date: null });
            })
        };
    }

    async function importBulkStudents() {
        clearPanelMessage();
        const validRows = bulkRows.filter(function (item) { return item.status === "valid"; });
        if (!validRows.length) {
            setPanelMessage("No valid rows available for import.", "error");
            return;
        }
        const client = window.VinayakAuth.getClient();
        let imported = 0;
        let failed = 0;
        for (const item of validRows) {
            try {
                const payload = buildBulkPayload(item);
                const studentResult = await client.from(window.VinayakAuth.getStudentsTableName()).insert([payload.student]);
                if (studentResult.error) throw studentResult.error;
                const feeResult = await client.from("student_fees").insert([payload.fee]);
                if (feeResult.error) throw feeResult.error;
                if (payload.emis.length) {
                    const emiResult = await client.from("emis").insert(payload.emis);
                    if (emiResult.error) throw emiResult.error;
                }
                item.status = "imported";
                item.errors = ["Imported successfully"];
                imported += 1;
            } catch (error) {
                console.error("Bulk row import failed", item, error);
                item.status = "failed";
                item.errors = [error.message || "Import failed"];
                failed += 1;
            }
        }
        setText("bulkFailedCount", failed);
        renderBulkRows();
        await refreshAll();
        setPanelMessage("Bulk import complete. Imported: " + imported + ". Failed: " + failed + ".", failed ? "error" : "success");
    }

    function downloadBlob(filename, content, type) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([content], { type: type }));
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function toCsv(rows) {
        return rows.map(function (row) {
            return row.map(function (cell) {
                return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
            }).join(",");
        }).join("\n");
    }

    function downloadSampleCsv() {
        downloadBlob("student-import-template.csv", toCsv([BULK_COLUMNS]), "text/csv;charset=utf-8");
    }

    function downloadSampleExcel() {
        if (!window.XLSX) {
            downloadSampleCsv();
            return;
        }
        const worksheet = window.XLSX.utils.aoa_to_sheet([BULK_COLUMNS]);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
        window.XLSX.writeFile(workbook, "student-import-template.xlsx");
    }

    function getExportRows() {
        return [BULK_COLUMNS.slice(0, 15)].concat(studentsCache.map(function (student) {
            const fee = getStudentFees(getIdentifier(student));
            return [getIdentifier(student), student.password, student.name, student.father_name, student.mobile, student.alternate_mobile, student.email, student.address, student.course, student.batch, student.admission_date, student.course_duration, fee.total_fee, fee.admission_fee, fee.remaining_fee];
        }));
    }

    function exportStudentsCsv() {
        downloadBlob("students-export.csv", toCsv(getExportRows()), "text/csv;charset=utf-8");
    }

    function exportStudentsExcel() {
        if (!window.XLSX) {
            exportStudentsCsv();
            return;
        }
        const worksheet = window.XLSX.utils.aoa_to_sheet(getExportRows());
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
        window.XLSX.writeFile(workbook, "students-export.xlsx");
    }

    async function refreshAll() {
        studentsCache = await fetchStudents();
        feesCache = await fetchTable("student_fees");
        emisCache = await fetchTable("emis");
        paymentsCache = await fetchOptionalTable("payments");
        coursesCache = await fetchOptionalTable("courses");
        batchesCache = await fetchOptionalTable("batches");
        updateBatchFilter();
        applyStudentFilter();
        renderEmis();
        renderDashboard();
    }

    function setupAdmissionDefaults() {
        setValue("newStudentId", generateStudentId());
        setValue("newAdmissionDate", getTodayDateString());
        setValue("newAccountStatus", "active");
        setValue("newTotalFee", "");
        setValue("newAdmissionFee", "");
        updateRemainingFee();
        renderAdmissionEmis([], false);
    }

    function addManualEmiRow() {
        const current = readManualEmis();
        current.push({ emi_number: current.length + 1, amount: 0, due_date: "", status: "pending" });
        renderAdmissionEmis(current, true);
    }

    function bindEvents() {
        const addForm = document.getElementById("addStudentForm");
        const editForm = document.getElementById("editStudentForm");
        const deleteForm = document.getElementById("deleteStudentForm");
        console.log("Admin JS loaded", {
            loadedAt: window.__vinayakAdminLoadedAt,
            viewportWidth: window.innerWidth,
            addStudentFormFound: Boolean(addForm),
            admissionSubmitButtons: addForm ? addForm.querySelectorAll('[type="submit"]').length : 0
        });
        if (addForm) {
            addForm.addEventListener("submit", addStudent);
            addForm.addEventListener("invalid", function (event) {
                console.warn("Admission form invalid field", {
                    id: event.target.id,
                    name: event.target.name,
                    value: event.target.value,
                    validationMessage: event.target.validationMessage
                });
                setPanelMessage(event.target.validationMessage || "Please complete the highlighted admission field.", "error");
            }, true);
        }
        if (editForm) editForm.addEventListener("submit", updateStudent);
        if (deleteForm) deleteForm.addEventListener("submit", deleteStudent);

        ["newTotalFee", "newAdmissionFee"].forEach(function (id) {
            const field = document.getElementById(id);
            if (field) field.addEventListener("input", updateRemainingFee);
        });
        document.getElementById("previewAutoEmiBtn").addEventListener("click", function () {
            try {
                renderAdmissionEmis(buildAutoEmis(), false);
            } catch (error) {
                setPanelMessage(error.message, "error");
            }
        });
        document.getElementById("addManualEmiBtn").addEventListener("click", addManualEmiRow);
        document.getElementById("admissionEmiBody").addEventListener("click", function (event) {
            if (event.target.closest("[data-remove-emi]")) {
                event.target.closest("tr").remove();
            }
        });
        document.querySelectorAll("[data-emi-mode]").forEach(function (button) {
            button.addEventListener("click", function () {
                emiMode = button.getAttribute("data-emi-mode");
                document.querySelectorAll("[data-emi-mode]").forEach(function (tab) { tab.classList.toggle("active", tab === button); });
                document.getElementById("autoEmiPanel").hidden = emiMode !== "auto";
                document.getElementById("manualEmiPanel").hidden = emiMode !== "manual";
                renderAdmissionEmis([], emiMode === "manual");
            });
        });
        document.addEventListener("click", function (event) {
            const sectionTarget = event.target.closest("[data-admin-section-target]");
            if (sectionTarget) showAdminSection(sectionTarget.getAttribute("data-admin-section-target"));
            const view = event.target.closest("[data-view-student]");
            if (view) renderProfile(view.getAttribute("data-view-student"));
            const edit = event.target.closest("[data-edit-student]");
            if (edit) {
                fillEditForm(getStudentById(edit.getAttribute("data-edit-student")));
                document.getElementById("editStudentCard").scrollIntoView({ behavior: "smooth", block: "start" });
            }
            const disable = event.target.closest("[data-disable-student]");
            if (disable) disableStudent(disable.getAttribute("data-disable-student"));
            const pay = event.target.closest("[data-pay-emi]");
            if (pay) markEmiPaid(pay.getAttribute("data-pay-student"), pay.getAttribute("data-pay-emi"));
        });
        document.getElementById("adminMenuBtn").addEventListener("click", function () {
            document.body.classList.toggle("admin-sidebar-open");
        });
        document.getElementById("addEditEmiBtn").addEventListener("click", addEditEmi);
        document.getElementById("editEmiTableBody").addEventListener("change", function (event) {
            const row = event.target.closest("[data-edit-emi-row]");
            if (row) updateEditEmi(row);
        });
        document.getElementById("editEmiTableBody").addEventListener("click", function (event) {
            const button = event.target.closest("[data-delete-edit-emi]");
            if (button) deleteEditEmi(button.getAttribute("data-delete-emi-student"), button.getAttribute("data-delete-edit-emi"));
        });
        document.getElementById("clearEditStudentBtn").addEventListener("click", clearEditForm);
        document.getElementById("closeProfileBtn").addEventListener("click", function () {
            document.getElementById("studentProfileCard").hidden = true;
        });
        ["studentSearchInput", "studentCourseFilter", "studentBatchFilter", "studentStatusFilter"].forEach(function (id) {
            document.getElementById(id).addEventListener("input", applyStudentFilter);
            document.getElementById(id).addEventListener("change", applyStudentFilter);
        });
        document.getElementById("dashboardCourseFilter").addEventListener("change", renderDashboard);
        document.getElementById("emiSearchInput").addEventListener("input", renderEmis);
        document.getElementById("validateImportBtn").addEventListener("click", validateBulkImport);
        document.getElementById("importStudentsBtn").addEventListener("click", importBulkStudents);
        document.getElementById("downloadSampleCsvBtn").addEventListener("click", downloadSampleCsv);
        document.getElementById("downloadSampleExcelBtn").addEventListener("click", downloadSampleExcel);
        document.getElementById("bulkSearchInput").addEventListener("input", renderBulkRows);
        document.getElementById("exportStudentsCsvBtn").addEventListener("click", exportStudentsCsv);
        document.getElementById("exportStudentsExcelBtn").addEventListener("click", exportStudentsExcel);
        document.getElementById("adminGlobalSearch").addEventListener("input", function () {
            setValue("studentSearchInput", getValue("adminGlobalSearch"));
            showAdminSection("students");
            applyStudentFilter();
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await window.VinayakAuth.initProtectedPage({ adminOnly: true });
            bindEvents();
            setupAdmissionDefaults();
            await refreshAll();
        } catch (error) {
            console.error("Admin panel init failed", error);
            setPanelMessage(error.message || "Admin panel could not load.", "error");
        }
    });
}());
