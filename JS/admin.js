(function () {
    window.__vinayakAdminLoadedAt = new Date().toISOString();
    const COURSES = ["ECCE", "ADFA", "DCFA", "EXCEL", "RS-CIT", "CCC"];
    let studentsCache = [];
    let feesCache = [];
    let emisCache = [];
    let paymentsCache = [];
    let coursesCache = [];
    let batchesCache = [];
    let notesCache = [];
    let materialCoursesCache = [];
    let announcementsCache = [];
    let attendanceHistoryCache = [];
    let attendanceReportCache = null;
    let activeAttendanceSessionId = "";
    let attendancePollTimer = null;
    let attendanceCountdownTimer = null;
    let attendanceRealtimeChannel = null;
    let activeAttendanceEndTime = "";
    let attendanceClosing = false;
    let attendanceRealtimeActive = false;
    const loadedAdminTables = {};
    let materialUploadQueue = [];
    let materialUploadCancelled = false;
    const activeMaterialUploads = {};
    let bulkRows = [];
    let emiMode = "auto";
    let currentAdmissionStep = 1;
    const paginationState = { students: 1, emi: 1, bulk: 1, material: 1, announcements: 1, attendanceHistory: 1 };
    const PAGE_SIZES = { students: 8, emi: 8, bulk: 10, material: 10, announcements: 10, attendanceHistory: 10 };
    const MAX_PDF_SIZE = 200 * 1024 * 1024;
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

    function getApiBase() {
        return window.VinayakApi ? window.VinayakApi.baseUrl : String(window.API_BASE_URL || window.VINAYAK_API_BASE || "").replace(/\/+$/, "");
    }

    function apiUrl(path) {
        return window.VinayakApi ? window.VinayakApi.url(path) : getApiBase() + path;
    }

    function getCourseId(course) {
        return String((course && course.id) || "");
    }

    function getCourseName(course) {
        return String((course && (course.course_name || course.name || course.title || course.course || course.code)) || "");
    }

    function getCourseLabelById(courseId) {
        const match = coursesCache.find(function (course) {
            return getCourseId(course) === String(courseId || "");
        });
        return match ? getCourseName(match) : String(courseId || "-");
    }

    function getNoteCourseIds(note) {
        const noteId = String((note && note.id) || "");
        const mapped = materialCoursesCache
            .filter(function (row) { return String(row.note_id || "") === noteId; })
            .map(function (row) { return String(row.course_id || ""); })
            .filter(Boolean);
        if (mapped.length) {
            return Array.from(new Set(mapped));
        }
        return note && note.course_id ? [String(note.course_id)] : [];
    }

    function getNoteCourseLabels(note) {
        const labels = getNoteCourseIds(note).map(getCourseLabelById).filter(Boolean);
        return labels.length ? labels.join(", ") : "-";
    }

    function setSelectOptions(selectId, options, placeholder, emptyText) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const current = select.value;
        if (!options.length) {
            select.innerHTML = '<option value="">' + escapeHtml(emptyText || "No courses available") + '</option>';
            select.value = "";
            return;
        }
        select.innerHTML = '<option value="">' + escapeHtml(placeholder || "Select course") + '</option>' + options.map(function (option) {
            return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
        }).join("");
        select.value = options.some(function (option) { return option.value === current; }) ? current : "";
    }

    function setFilterOptions(selectId, options, allText) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">' + escapeHtml(allText || "All") + '</option>' + options.map(function (option) {
            return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
        }).join("");
        select.value = options.some(function (option) { return option.value === current; }) ? current : "";
    }

    function getCourseOptions() {
        return coursesCache
            .map(function (course) {
                return { id: getCourseId(course), name: getCourseName(course) };
            })
            .filter(function (course) { return course.id && course.name; })
            .sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    function getSelectedMaterialCourseIds() {
        return Array.from(document.querySelectorAll('[name="materialCourseIds"]:checked'))
            .map(function (input) { return input.value; })
            .filter(Boolean);
    }

    function renderMaterialCourseChecklist(selectedIds) {
        const target = document.getElementById("materialCourseChecklist");
        if (!target) return;
        const selected = selectedIds || getSelectedMaterialCourseIds();
        const options = getCourseOptions();
        if (!options.length) {
            target.innerHTML = '<span>No courses available</span>';
            return;
        }
        target.innerHTML = options.map(function (course) {
            const checked = selected.includes(course.id) ? " checked" : "";
            return '<label class="material-course-option"><input type="checkbox" name="materialCourseIds" value="' + escapeHtml(course.id) + '"' + checked + '><span>' + escapeHtml(course.name) + '</span></label>';
        }).join("");
    }

    function getSelectedAnnouncementCourseIds() {
        return Array.from(document.querySelectorAll('[name="announcementCourseIds"]:checked'))
            .map(function (input) { return input.value; })
            .filter(Boolean);
    }

    function renderAnnouncementCourseChecklist(selectedIds) {
        const target = document.getElementById("announcementCourseChecklist");
        if (!target) return;
        const selected = selectedIds || getSelectedAnnouncementCourseIds();
        const options = getCourseOptions();
        if (!options.length) {
            target.innerHTML = '<span>No courses available</span>';
            return;
        }
        target.innerHTML = options.map(function (course) {
            const checked = selected.includes(course.id) ? " checked" : "";
            return '<label class="material-course-option"><input type="checkbox" name="announcementCourseIds" value="' + escapeHtml(course.id) + '"' + checked + '><span>' + escapeHtml(course.name) + '</span></label>';
        }).join("");
    }

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
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
        const courseBackedSections = ["admissions", "courses", "material", "batches", "notifications"];
        if (courseBackedSections.includes(sectionName) || sectionName === "attendance") loadCourses();
        if (sectionName === "courses") ensureMaterialLoaded();
        if (sectionName === "material") ensureMaterialLoaded();
        if (sectionName === "notifications") ensureAnnouncementsLoaded();
        if (sectionName === "attendance") {
            updateAttendanceControls();
            loadAttendanceHistory();
        }
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

    function paginateRows(rows, key) {
        const pageSize = PAGE_SIZES[key] || 8;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        paginationState[key] = Math.max(1, Math.min(paginationState[key] || 1, totalPages));
        const start = (paginationState[key] - 1) * pageSize;
        return {
            rows: rows.slice(start, start + pageSize),
            page: paginationState[key],
            totalPages: totalPages,
            totalItems: rows.length
        };
    }

    function renderPagination(targetId, key, page, totalPages, totalItems) {
        const container = document.getElementById(targetId);
        if (!container) {
            return;
        }
        if (totalItems <= (PAGE_SIZES[key] || 8)) {
            container.innerHTML = "";
            container.hidden = true;
            return;
        }
        container.hidden = false;
        const pageButtons = [];
        for (let current = 1; current <= totalPages; current += 1) {
            pageButtons.push(
                '<button type="button" class="erp-page-btn' + (current === page ? " active" : "") + '" data-pagination-key="' + key + '" data-pagination-page="' + current + '">' + current + "</button>"
            );
        }
        container.innerHTML = '<span class="erp-pagination-meta">Showing page ' + page + " of " + totalPages + " | " + totalItems + ' records</span><div class="erp-pagination-actions"><button type="button" class="erp-page-btn" data-pagination-key="' + key + '" data-pagination-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? " disabled" : "") + '>Prev</button>' + pageButtons.join("") + '<button type="button" class="erp-page-btn" data-pagination-key="' + key + '" data-pagination-page="' + Math.min(totalPages, page + 1) + '"' + (page === totalPages ? " disabled" : "") + ">Next</button></div>";
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

    async function fetchTable(tableName, options) {
        const settings = options || {};
        let query = window.VinayakAuth.getClient()
            .from(tableName)
            .select(settings.columns || "*");
        if (settings.orderBy) {
            query = query.order(settings.orderBy, { ascending: Boolean(settings.ascending) });
        }
        if (settings.limit) {
            query = query.limit(settings.limit);
        }
        const { data, error } = await query;
        if (error) {
            throw error;
        }
        return data || [];
    }

    async function fetchOptionalTable(tableName, options) {
        try {
            return await fetchTable(tableName, options);
        } catch (error) {
            console.warn("Optional table fetch failed", tableName, error);
            return [];
        }
    }

    async function ensureMaterialLoaded(force) {
        if (!force && loadedAdminTables.material) {
            renderMaterials();
            renderCourses();
            return;
        }
        try {
            await loadMaterialManagerRows();
        } catch (error) {
            console.error("R2 study material manager load failed", error);
            notesCache = [];
            materialCoursesCache = [];
            setPanelMessage(error.message || "Could not load R2 study material.", "error");
        }
        loadedAdminTables.material = true;
        renderMaterials();
        renderCourses();
    }

    async function loadMaterialManagerRows() {
        const url = apiUrl("/api/admin/materials");
        console.log("Study Material Manager list URL", url);
        const response = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) {
            throw new Error(result.message || result.error || "Could not load R2 study material.");
        }
        notesCache = result.materials || [];
        materialCoursesCache = result.material_courses || [];
    }

    async function ensureAnnouncementsLoaded(force) {
        if (!force && loadedAdminTables.announcements) {
            renderAnnouncementsAdmin();
            return;
        }
        announcementsCache = await fetchOptionalTable("announcements");
        loadedAdminTables.announcements = true;
        renderAnnouncementsAdmin();
    }

    async function ensurePaymentsLoaded(force) {
        if (!force && loadedAdminTables.payments) return paymentsCache;
        paymentsCache = await fetchOptionalTable("payments");
        loadedAdminTables.payments = true;
        return paymentsCache;
    }

    async function loadCourses(force) {
        if (!force && coursesCache.length) {
            updateCourseControls();
            renderCourses();
            return coursesCache;
        }
        console.group("loadCourses");
        try {
            const { data, error } = await window.VinayakAuth.getClient()
                .from("courses")
                .select("id, course_name, duration, total_fee, description, created_at")
                .order("course_name", { ascending: true });
            console.log("Supabase courses response", { data: data, error: error });
            if (error) {
                throw error;
            }
            coursesCache = data || [];
            console.log("Courses loaded", { count: coursesCache.length, rows: coursesCache });
            updateCourseControls();
            renderCourses();
            return coursesCache;
        } catch (error) {
            console.error("Course loading failed", error);
            coursesCache = [];
            updateCourseControls("Could not load courses");
            renderCourses();
            setPanelMessage((error && error.message ? error.message : "Could not load courses.") + " Check the browser console for the Supabase courses response.", "error");
            return [];
        } finally {
            console.groupEnd();
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
            renderPagination("studentsPagination", "students", 1, 1, 0);
            return;
        }
        const pageData = paginateRows(students, "students");
        pageData.rows.forEach(function (student) {
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
        renderPagination("studentsPagination", "students", pageData.page, pageData.totalPages, pageData.totalItems);
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

    function applyStudentFilter(resetPage) {
        const query = getValue("studentSearchInput").toLowerCase();
        const course = getValue("studentCourseFilter");
        const batch = getValue("studentBatchFilter");
        const status = getValue("studentStatusFilter");
        if (resetPage !== false) {
            paginationState.students = 1;
        }
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

    async function renderProfile(studentId) {
        const student = getStudentById(studentId);
        if (!student) {
            return;
        }
        await ensurePaymentsLoaded();
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
        const pageData = paginateRows(rows, "emi");
        tbody.innerHTML = pageData.rows.length ? pageData.rows.map(function (emi) {
            const status = normalizeEmiStatus(emi.status);
            return [
                "<tr><td>", escapeHtml(emi.student_id), "</td><td>", escapeHtml(emi.emi_number), "</td><td>", money(emi.amount), "</td><td>",
                escapeHtml(emi.due_date || "-"), '</td><td><span class="status-badge ', status === "paid" ? "status-paid" : "status-due", '">', escapeHtml(status),
                "</span></td><td>", escapeHtml(emi.paid_date || "-"), "</td><td>",
                status === "paid" ? "-" : '<button type="button" class="table-action-btn" data-pay-emi="' + escapeHtml(emi.id || emi.emi_number) + '" data-pay-student="' + escapeHtml(emi.student_id) + '">Mark Paid</button>',
                "</td></tr>"
            ].join("");
        }).join("") : '<tr><td colspan="7" class="admin-empty">No EMI records.</td></tr>';
        renderPagination("emiPagination", "emi", pageData.page, pageData.totalPages, pageData.totalItems);
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
        const pageData = paginateRows(rows, "bulk");
        tbody.innerHTML = pageData.rows.length ? pageData.rows.map(function (item) {
            const row = item.row;
            return "<tr><td>" + escapeHtml(row.__rowNumber) + "</td><td>" + escapeHtml(getBulkValue(row, "Student ID")) + "</td><td>" + escapeHtml(getBulkValue(row, "Student Name")) + "</td><td>" + escapeHtml(getBulkValue(row, "Mobile")) + "</td><td>" + escapeHtml(getBulkValue(row, "Course")) + "</td><td>" + escapeHtml(getBulkValue(row, "Batch")) + '</td><td><span class="status-badge ' + (item.status === "valid" ? "status-paid" : "status-due") + '">' + escapeHtml(item.status) + "</span></td><td>" + escapeHtml(item.errors.join("; ") || "Ready") + "</td></tr>";
        }).join("") : '<tr><td colspan="8" class="admin-empty">No import rows loaded.</td></tr>';
        renderPagination("bulkPagination", "bulk", pageData.page, pageData.totalPages, pageData.totalItems);
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

    function validatePdfFile(file) {
        if (!file) {
            throw new Error("Choose a PDF file.");
        }
        if (file.size > MAX_PDF_SIZE) {
            throw new Error("PDF must be 200 MB or smaller.");
        }
        if (file.type && file.type !== "application/pdf") {
            throw new Error("Only PDF files are allowed.");
        }
        if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") {
            throw new Error("Only PDF files are allowed.");
        }
    }

    async function uploadMaterialToBackend(file, title, subject, courseIds, noteId, options) {
        const settings = options || {};
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title);
        formData.append("subject", subject);
        formData.append("chapter", settings.chapter || "");
        formData.append("uploaded_by", settings.uploadedBy || "admin");
        formData.append("course_id", courseIds[0] || "");
        formData.append("course_ids", JSON.stringify(courseIds));
        formData.append("original_filename", file.name || title || "material.pdf");
        if (noteId) formData.append("note_id", noteId);

        return new Promise(function (resolve, reject) {
            const xhr = new XMLHttpRequest();
            const url = apiUrl("/api/upload-material");
            console.log("Study Material upload URL", url);
            xhr.open("POST", url);
            if (settings.uploadId) {
                activeMaterialUploads[settings.uploadId] = xhr;
            }
            xhr.upload.onprogress = function (event) {
                if (event.lengthComputable && typeof settings.onProgress === "function") {
                    settings.onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
            xhr.onload = function () {
                if (settings.uploadId) delete activeMaterialUploads[settings.uploadId];
                let result = {};
                try {
                    result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                } catch (error) {
                    result = {
                        message: "R2 upload endpoint returned non-JSON response.",
                        rawBody: xhr.responseText
                    };
                }
                if (xhr.status < 200 || xhr.status >= 300 || !result.success) {
                    console.error("Study material backend upload returned an error", result);
                    const detailLines = [
                        result.message || result.error || "Study material upload failed.",
                        "HTTP Status: " + xhr.status,
                        result.code ? "Code: " + result.code : "",
                        result.status ? "Status: " + result.status : "",
                        result.stack ? "Stack: " + result.stack : "",
                        result.rawBody ? "Raw Response: " + result.rawBody : ""
                    ].filter(Boolean);
                    reject(new Error(detailLines.join("\n")));
                    return;
                }
                resolve(result);
            };
            xhr.onerror = function () {
                if (settings.uploadId) delete activeMaterialUploads[settings.uploadId];
                reject(new Error("Network error while uploading PDF to R2."));
            };
            xhr.onabort = function () {
                if (settings.uploadId) delete activeMaterialUploads[settings.uploadId];
                reject(new Error("Upload cancelled."));
            };
            xhr.send(formData);
        });
    }

    async function deletePdfFromR2(key) {
        if (!key) return;
        const url = apiUrl("/api/r2/delete");
        console.log("Study Material R2 delete URL", url);
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key })
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) {
            throw new Error(result.error || "Could not delete PDF from Cloudflare R2.");
        }
    }

    async function getR2SignedUrl(key) {
        const url = apiUrl("/api/r2/sign?key=" + encodeURIComponent(key));
        console.log("Study Material R2 sign URL", url);
        const response = await fetch(url, {
            method: "GET"
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success || !result.signedUrl) {
            throw new Error(result.error || "Could not create a secure R2 PDF link.");
        }
        return result.signedUrl;
    }

    function setMaterialProgress(percent) {
        const bar = document.getElementById("materialUploadProgress");
        if (!bar) return;
        const shell = document.getElementById("materialUploadStatus");
        if (shell) shell.hidden = false;
        const fill = bar.querySelector("span");
        if (fill) fill.style.width = Math.max(0, Math.min(100, percent)) + "%";
        if (percent >= 100) {
            window.setTimeout(function () { if (fill) fill.style.width = "0%"; }, 900);
        }
    }

    function getMaterialKey(note) {
        return String((note && (note.r2_key || note.file_path)) || "");
    }

    function getMaterialChapter(note) {
        return String((note && note.chapter) || "");
    }

    function getMaterialUploadDate(note) {
        return String((note && (note.uploaded_at || note.created_at)) || "");
    }

    function getMaterialSize(note) {
        const size = Number(note && note.file_size || 0);
        if (!Number.isFinite(size) || size <= 0) return "-";
        if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
        return Math.max(1, Math.round(size / 1024)) + " KB";
    }

    function getMaterialTitleFromFile(file) {
        return String(file && file.name || "Study Material").replace(/\.[^/.]+$/, "");
    }

    function setMaterialUploadStatus(text) {
        const status = document.getElementById("materialUploadStatusText");
        if (status) status.textContent = text;
    }

    function updateMaterialUploadCounts() {
        const count = document.getElementById("materialUploadCountText");
        if (!count) return;
        const completed = materialUploadQueue.filter(function (item) { return item.status === "completed"; }).length;
        const failed = materialUploadQueue.filter(function (item) { return item.status === "failed"; }).length;
        count.textContent = completed + " completed / " + failed + " failed / " + materialUploadQueue.length + " total";
        const retry = document.getElementById("retryFailedMaterialBtn");
        if (retry) retry.hidden = failed <= 0;
    }

    function renderMaterialUploadQueue() {
        const target = document.getElementById("materialUploadQueue");
        if (!target) return;
        target.hidden = !materialUploadQueue.length;
        const previewRows = materialUploadQueue.slice(0, 120);
        target.innerHTML = [
            '<div class="material-queue-head"><strong>Upload Queue</strong><span>', materialUploadQueue.length, ' PDF(s)</span></div>',
            '<div class="material-queue-list">',
            previewRows.map(function (item) {
                return '<div class="material-queue-row ' + escapeHtml(item.status || "waiting") + '"><span>' + escapeHtml(item.file.name) + '</span><small>' + escapeHtml(item.status || "waiting") + (item.progress ? " " + item.progress + "%" : "") + (item.error ? " - " + item.error : "") + '</small></div>';
            }).join(""),
            materialUploadQueue.length > previewRows.length ? '<div class="material-queue-row"><span>+' + (materialUploadQueue.length - previewRows.length) + ' more files queued</span><small>They will upload in order.</small></div>' : "",
            "</div>"
        ].join("");
        updateMaterialUploadCounts();
    }

    function cancelMaterialUploads() {
        materialUploadCancelled = true;
        Object.keys(activeMaterialUploads).forEach(function (id) {
            try {
                activeMaterialUploads[id].abort();
            } catch (error) {
                console.warn("Material upload abort failed", error);
            }
            delete activeMaterialUploads[id];
        });
        materialUploadQueue.forEach(function (item) {
            if (item.status === "waiting" || item.status === "uploading") {
                item.status = "failed";
                item.error = "Upload cancelled.";
            }
        });
        setMaterialUploadStatus("Upload cancelled");
        renderMaterialUploadQueue();
    }

    function addMaterialFiles(files) {
        const seen = {};
        const pdfs = Array.from(files || []).filter(function (file) {
            return file && (/\.pdf$/i.test(file.name || "") || file.type === "application/pdf");
        }).filter(function (file) {
            const key = [file.name, file.size, file.lastModified].join("|");
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
        materialUploadQueue = pdfs.map(function (file, index) {
            return {
                id: Date.now() + "-" + index + "-" + Math.random().toString(16).slice(2),
                file: file,
                status: "waiting",
                progress: 0,
                error: ""
            };
        });
        renderMaterialUploadQueue();
        if (!pdfs.length && files && files.length) {
            setPanelMessage("Only PDF files can be uploaded.", "error");
        }
    }

    function getFilteredNotes() {
        const query = getValue("materialSearchInput").toLowerCase();
        const course = getValue("materialCourseFilter");
        const subject = getValue("materialSubjectFilter");
        const uploadDate = getValue("materialDateFilter");
        return notesCache.filter(function (note) {
            const courseIds = getNoteCourseIds(note);
            const courseLabel = getNoteCourseLabels(note);
            const matchesQuery = !query || [note.title, note.original_filename, note.subject, getMaterialChapter(note), note.course_id, courseLabel].join(" ").toLowerCase().includes(query);
            const matchesCourse = !course || course === "all" || courseIds.includes(String(course));
            const matchesSubject = !subject || subject === "all" || String(note.subject || "General") === subject;
            const matchesDate = !uploadDate || getMaterialUploadDate(note).slice(0, 10) === uploadDate;
            return matchesQuery && matchesCourse && matchesSubject && matchesDate;
        });
    }

    function updateCourseControls(errorText) {
        const options = getCourseOptions();
        const nameOptions = options.map(function (course) {
            return { value: course.name, label: course.name };
        });
        const uuidOptions = options.map(function (course) {
            return { value: course.id, label: course.name };
        });
        const emptyText = errorText || "No courses available";

        setSelectOptions("newStudentCourse", nameOptions, "Select course", emptyText);
        setSelectOptions("editStudentCourse", nameOptions, "Select course", emptyText);
        setFilterOptions("studentCourseFilter", nameOptions, "All");
        setFilterOptions("dashboardCourseFilter", nameOptions, "All Courses");

        renderMaterialCourseChecklist();
        renderAnnouncementCourseChecklist();
        setAnnouncementAllCoursesState();
        updateAttendanceControls();
        const materialFilter = document.getElementById("materialCourseFilter");
        if (materialFilter) {
            const currentFilter = materialFilter.value;
            materialFilter.innerHTML = '<option value="all">All Courses</option>' + uuidOptions.map(function (option) {
                return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>';
            }).join("");
            materialFilter.value = uuidOptions.some(function (option) { return option.value === currentFilter; }) ? currentFilter : "all";
        }
    }

    function updateMaterialSubjectFilter() {
        const filter = document.getElementById("materialSubjectFilter");
        if (!filter) return;
        const current = filter.value || "all";
        const subjects = Array.from(new Set(notesCache.map(function (note) {
            return String(note.subject || "General");
        }))).sort();
        filter.innerHTML = '<option value="all">All Subjects</option>' + subjects.map(function (subject) {
            return '<option value="' + escapeHtml(subject) + '">' + escapeHtml(subject) + '</option>';
        }).join("");
        filter.value = subjects.includes(current) ? current : "all";
    }

    function getCourseLinkedStudents(courseName) {
        return studentsCache.filter(function (student) {
            return String(student.course || "") === String(courseName || "");
        });
    }

    function getCourseLinkedNotes(courseId) {
        return notesCache.filter(function (note) {
            return getNoteCourseIds(note).includes(String(courseId || ""));
        });
    }

    function renderCourseStats() {
        setText("courseStatTotal", coursesCache.length);
        setText("courseStatStudents", coursesCache.reduce(function (sum, course) {
            return sum + getCourseLinkedStudents(getCourseName(course)).length;
        }, 0));
        setText("courseStatNotes", coursesCache.reduce(function (sum, course) {
            return sum + getCourseLinkedNotes(getCourseId(course)).length;
        }, 0));
    }

    function renderCourses() {
        const tbody = document.getElementById("coursesTableBody");
        renderCourseStats();
        if (!tbody) return;
        const query = getValue("courseSearchInput").toLowerCase();
        const rows = coursesCache.filter(function (course) {
            return !query || [getCourseName(course), course.duration, course.total_fee, course.description].join(" ").toLowerCase().includes(query);
        });
        tbody.innerHTML = rows.length ? rows.map(function (course) {
            const courseId = getCourseId(course);
            const courseName = getCourseName(course);
            const studentCount = getCourseLinkedStudents(courseName).length;
            const noteCount = getCourseLinkedNotes(courseId).length;
            return [
                "<tr>",
                "<td><strong>", escapeHtml(courseName), "</strong><small>", escapeHtml(course.description || ""), "</small></td>",
                "<td>", escapeHtml(course.duration || "-"), "</td>",
                "<td>", money(course.total_fee || 0), "</td>",
                "<td>", studentCount, "</td>",
                "<td>", noteCount, "</td>",
                '<td><button type="button" class="table-action-btn" data-edit-course="', escapeHtml(courseId), '">Edit</button> ',
                '<button type="button" class="table-action-btn danger-btn" data-delete-course="', escapeHtml(courseId), '">Delete</button></td>',
                "</tr>"
            ].join("");
        }).join("") : '<tr><td colspan="6" class="admin-empty">' + (coursesCache.length ? "No matching courses." : "No courses available.") + "</td></tr>";
    }

    function clearCourseForm() {
        const form = document.getElementById("courseForm");
        if (form) form.reset();
        setValue("courseRecordId", "");
    }

    function fillCourseForm(courseId) {
        const course = coursesCache.find(function (item) { return getCourseId(item) === String(courseId || ""); });
        if (!course) {
            setPanelMessage("Course record not found.", "error");
            return;
        }
        setValue("courseRecordId", getCourseId(course));
        setValue("courseNameInput", getCourseName(course));
        setValue("courseDurationInput", course.duration || "");
        setValue("courseTotalFeeInput", course.total_fee || "");
        setValue("courseDescriptionInput", course.description || "");
        const form = document.getElementById("courseForm");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function saveCourse(event) {
        event.preventDefault();
        clearPanelMessage();
        const courseId = getValue("courseRecordId");
        const payload = {
            course_name: getValue("courseNameInput"),
            duration: getValue("courseDurationInput") || null,
            total_fee: getValue("courseTotalFeeInput") ? toNumber(getValue("courseTotalFeeInput")) : null,
            description: getValue("courseDescriptionInput") || null
        };
        if (!payload.course_name) {
            setPanelMessage("Enter course name.", "error");
            return;
        }
        try {
            const client = window.VinayakAuth.getClient();
            const result = courseId
                ? await client.from("courses").update(payload).eq("id", courseId)
                : await client.from("courses").insert([payload]);
            console.log("Course save response", result);
            if (result.error) throw result.error;
            setPanelMessage(courseId ? "Course updated successfully." : "Course added successfully.", "success");
            clearCourseForm();
            await loadCourses(true);
            renderDashboard();
            applyStudentFilter(false);
        } catch (error) {
            console.error("Course save failed", error);
            setPanelMessage(error.message || "Could not save course.", "error");
        }
    }

    async function deleteCourse(courseId) {
        const course = coursesCache.find(function (item) { return getCourseId(item) === String(courseId || ""); });
        if (!course) return;
        const studentCount = getCourseLinkedStudents(getCourseName(course)).length;
        const noteCount = getCourseLinkedNotes(getCourseId(course)).length;
        if (studentCount || noteCount) {
            setPanelMessage("Cannot delete this course because it is linked to " + studentCount + " student(s) and " + noteCount + " study material record(s).", "error");
            return;
        }
        if (!window.confirm("Delete course '" + getCourseName(course) + "'? This cannot be undone.")) {
            return;
        }
        try {
            const result = await window.VinayakAuth.getClient().from("courses").delete().eq("id", courseId);
            console.log("Course delete response", result);
            if (result.error) throw result.error;
            setPanelMessage("Course deleted successfully.", "success");
            await loadCourses(true);
        } catch (error) {
            console.error("Course delete failed", error);
            setPanelMessage(error.message || "Could not delete course.", "error");
        }
    }

    function renderMaterials() {
        const tbody = document.getElementById("materialTableBody");
        if (!tbody) return;
        updateMaterialSubjectFilter();
        const rows = getFilteredNotes();
        const pageData = paginateRows(rows, "material");
        tbody.innerHTML = pageData.rows.length ? pageData.rows.map(function (note) {
            return [
                "<tr>",
                "<td>", escapeHtml(note.title || "Study Material"), "</td>",
                "<td>", escapeHtml(note.subject || "General"), "</td>",
                "<td>", escapeHtml(getMaterialChapter(note) || "-"), "</td>",
                "<td>", escapeHtml(getNoteCourseLabels(note)), "</td>",
                "<td>", escapeHtml(getMaterialSize(note)), "</td>",
                "<td>", escapeHtml(getMaterialUploadDate(note) ? getMaterialUploadDate(note).slice(0, 10) : "-"), "</td>",
                '<td><button type="button" class="table-action-btn" data-preview-material="', escapeHtml(note.id), '">Preview</button> ',
                '<button type="button" class="table-action-btn" data-edit-material="', escapeHtml(note.id), '">Rename</button> ',
                '<button type="button" class="table-action-btn" data-move-material-subject="', escapeHtml(note.id), '">Move Subject</button> ',
                '<button type="button" class="table-action-btn" data-edit-material-courses="', escapeHtml(note.id), '">Assign Courses</button> ',
                '<button type="button" class="table-action-btn" data-remove-material-course="', escapeHtml(note.id), '">Remove Course</button> ',
                '<button type="button" class="table-action-btn" data-replace-material="', escapeHtml(note.id), '">Replace</button> ',
                '<button type="button" class="table-action-btn" data-copy-r2-link="', escapeHtml(note.id), '">Copy R2 Link</button> ',
                '<button type="button" class="table-action-btn danger-btn" data-delete-material="', escapeHtml(note.id), '">Delete</button></td>',
                "</tr>"
            ].join("");
        }).join("") : '<tr><td colspan="7" class="admin-empty">No study material found.</td></tr>';
        renderPagination("materialPagination", "material", pageData.page, pageData.totalPages, pageData.totalItems);
    }

    async function uploadStudyMaterial(event) {
        event.preventDefault();
        clearPanelMessage();
        const courseIds = getSelectedMaterialCourseIds();
        const subject = getValue("materialSubjectInput");
        const chapter = getValue("materialChapterInput");
        const fileInput = document.getElementById("materialFileInput");
        if (!materialUploadQueue.length && fileInput && fileInput.files && fileInput.files.length) {
            addMaterialFiles(fileInput.files);
        }
        const targets = materialUploadQueue.filter(function (item) {
            return item.status === "waiting" || item.status === "failed";
        });
        if (!courseIds.length || !subject || !targets.length) {
            setPanelMessage("Select at least one course, a subject, and one or more PDF files.", "error");
            return;
        }
        targets.forEach(function (item) {
            try {
                validatePdfFile(item.file);
            } catch (error) {
                item.status = "failed";
                item.error = error.message;
            }
        });
        const uploadable = targets.filter(function (item) { return item.status !== "failed"; });
        if (!uploadable.length) {
            renderMaterialUploadQueue();
            setPanelMessage("No valid PDF files to upload.", "error");
            return;
        }
        const button = document.getElementById("materialBulkUploadBtn");
        const cancelButton = document.getElementById("cancelMaterialUploadBtn");
        if (button) button.disabled = true;
        if (cancelButton) cancelButton.hidden = false;
        materialUploadCancelled = false;
        setMaterialUploadStatus("Uploading...");
        setMaterialProgress(0);
        try {
            let completed = materialUploadQueue.filter(function (item) { return item.status === "completed"; }).length;
            const concurrency = 3;
            let cursor = 0;
            async function worker() {
                while (cursor < uploadable.length) {
                    if (materialUploadCancelled) return;
                    const item = uploadable[cursor];
                    cursor += 1;
                    item.status = "uploading";
                    item.error = "";
                    renderMaterialUploadQueue();
                    try {
                        await uploadMaterialToBackend(item.file, getMaterialTitleFromFile(item.file), subject, courseIds, "", {
                            uploadId: item.id,
                            chapter: chapter,
                            uploadedBy: "admin",
                            onProgress: function (progress) {
                                item.progress = progress;
                                renderMaterialUploadQueue();
                            }
                        });
                        item.status = "completed";
                        item.progress = 100;
                        completed += 1;
                        setMaterialProgress(Math.round((completed / materialUploadQueue.length) * 100));
                    } catch (error) {
                        item.status = "failed";
                        item.error = error.message || "Upload failed.";
                    }
                    renderMaterialUploadQueue();
                }
            }
            await Promise.all(Array.from({ length: Math.min(concurrency, uploadable.length) }, worker));
            const failed = materialUploadQueue.filter(function (item) { return item.status === "failed"; }).length;
            setMaterialUploadStatus(failed ? "Completed with failed uploads" : "Completed");
            if (!failed) {
                document.getElementById("materialUploadForm").reset();
                renderMaterialCourseChecklist([]);
                materialUploadQueue = [];
                renderMaterialUploadQueue();
            }
            const fileInput = document.getElementById("materialFileInput");
            const folderInput = document.getElementById("materialFolderInput");
            if (fileInput) fileInput.value = "";
            if (folderInput) folderInput.value = "";
            setPanelMessage("Bulk upload complete. Uploaded: " + completed + ". Failed: " + failed + ".", failed ? "error" : "success");
            await ensureMaterialLoaded(true);
        } catch (error) {
            console.error("Study material upload failed", error);
            setPanelMessage(error.message || "Could not upload study material.", "error");
        } finally {
            if (button) button.disabled = false;
            if (cancelButton) cancelButton.hidden = true;
        }
    }

    function findMaterial(id) {
        return notesCache.find(function (note) { return String(note.id) === String(id); });
    }

    async function previewMaterial(id) {
        try {
            const note = findMaterial(id);
            const key = getMaterialKey(note);
            if (!note || !key) throw new Error("PDF path is missing.");
            const signedUrl = await getR2SignedUrl(key);
            window.location.href = signedUrl;
        } catch (error) {
            console.error("Study material preview failed", error);
            setPanelMessage(error.message || "Could not preview PDF.", "error");
        }
    }

    async function editMaterial(id) {
        const note = findMaterial(id);
        if (!note) return;
        const title = window.prompt("Rename PDF title", note.title || "");
        if (title == null) return;
        try {
            const { error } = await window.VinayakAuth.getClient().from("notes").update({ title: title.trim() || "Study Material" }).eq("id", id);
            if (error) throw error;
            setPanelMessage("Study material renamed.", "success");
            await ensureMaterialLoaded(true);
        } catch (error) {
            console.error("Study material rename failed", error);
            setPanelMessage(error.message || "Could not rename study material.", "error");
        }
    }

    async function moveMaterialSubject(id) {
        const note = findMaterial(id);
        if (!note) return;
        const subject = window.prompt("Move to subject", note.subject || "General");
        if (subject == null) return;
        try {
            const { error } = await window.VinayakAuth.getClient().from("notes").update({ subject: subject.trim() || "General" }).eq("id", id);
            if (error) throw error;
            setPanelMessage("Study material moved to " + (subject.trim() || "General") + ".", "success");
            await ensureMaterialLoaded(true);
        } catch (error) {
            console.error("Study material subject move failed", error);
            setPanelMessage(error.message || "Could not move study material.", "error");
        }
    }

    function resolveCourseIdsFromText(value) {
        const entries = String(value || "").split(",").map(function (item) {
            return normalizeKey(item);
        }).filter(Boolean);
        return Array.from(new Set(entries.map(function (entry) {
            const match = coursesCache.find(function (course) {
                return normalizeKey(getCourseId(course)) === entry || normalizeKey(getCourseName(course)) === entry;
            });
            return match ? getCourseId(match) : "";
        }).filter(Boolean)));
    }

    async function saveMaterialCourseLinks(noteId, courseIds) {
        const client = window.VinayakAuth.getClient();
        const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
        if (!uniqueCourseIds.length) {
            throw new Error("Select at least one valid course.");
        }
        const primaryCourseId = uniqueCourseIds[0];
        const updateResult = await client.from("notes").update({ course_id: primaryCourseId }).eq("id", noteId);
        if (updateResult.error) throw updateResult.error;
        const deleteResult = await client.from("material_courses").delete().eq("note_id", noteId);
        if (deleteResult.error) throw deleteResult.error;
        const insertResult = await client.from("material_courses").insert(uniqueCourseIds.map(function (courseId) {
            return { note_id: noteId, course_id: courseId };
        }));
        if (insertResult.error) throw insertResult.error;
    }

    async function editMaterialCourses(id) {
        const note = findMaterial(id);
        if (!note) return;
        const current = getNoteCourseLabels(note);
        const value = window.prompt("Assign courses by course name or UUID, separated by comma", current === "-" ? "" : current);
        if (value == null) return;
        const courseIds = resolveCourseIdsFromText(value);
        if (!courseIds.length) {
            setPanelMessage("No valid courses found. Use exact course names from Course Management.", "error");
            return;
        }
        try {
            await saveMaterialCourseLinks(id, courseIds);
            await ensureMaterialLoaded(true);
            setPanelMessage("Study material course access updated.", "success");
        } catch (error) {
            console.error("Study material course update failed", error);
            setPanelMessage(error.message || "Could not update course access.", "error");
        }
    }

    async function removeMaterialCourse(id) {
        const note = findMaterial(id);
        if (!note) return;
        const currentIds = getNoteCourseIds(note);
        if (currentIds.length <= 1) {
            setPanelMessage("A PDF must stay assigned to at least one course. Use Delete to remove it completely.", "error");
            return;
        }
        const current = getNoteCourseLabels(note);
        const value = window.prompt("Remove which course? Enter exact course name or UUID.\nCurrent: " + current, "");
        if (value == null) return;
        const removeIds = resolveCourseIdsFromText(value);
        if (!removeIds.length) {
            setPanelMessage("No matching course found.", "error");
            return;
        }
        const nextIds = currentIds.filter(function (courseId) {
            return !removeIds.includes(String(courseId));
        });
        if (!nextIds.length) {
            setPanelMessage("Cannot remove all courses from a PDF. Use Delete instead.", "error");
            return;
        }
        try {
            await saveMaterialCourseLinks(id, nextIds);
            await ensureMaterialLoaded(true);
            setPanelMessage("Course access removed.", "success");
        } catch (error) {
            console.error("Study material remove course failed", error);
            setPanelMessage(error.message || "Could not remove course access.", "error");
        }
    }

    async function copyMaterialR2Link(id) {
        const note = findMaterial(id);
        const key = getMaterialKey(note);
        if (!key) {
            setPanelMessage("R2 key is missing for this PDF.", "error");
            return;
        }
        try {
            const signedUrl = await getR2SignedUrl(key);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(signedUrl);
                setPanelMessage("Secure R2 preview link copied.", "success");
                return;
            }
            window.prompt("Copy R2 link", signedUrl);
        } catch (error) {
            console.error("Copy R2 link failed", error);
            setPanelMessage(error.message || "Could not copy R2 link.", "error");
        }
    }

    async function replaceMaterial(id) {
        const note = findMaterial(id);
        if (!note) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf,.pdf";
        input.addEventListener("change", async function () {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                validatePdfFile(file);
                const noteCourseIds = getNoteCourseIds(note);
                const courseIds = noteCourseIds.length ? noteCourseIds : [note.course_id].filter(Boolean);
                setMaterialProgress(20);
                console.log("Replacing study material through backend", { oldKey: note.file_path, courses: courseIds, size: file.size });
                await uploadMaterialToBackend(file, note.title, note.subject || "General", courseIds, id, { chapter: getMaterialChapter(note), uploadedBy: "admin" });
                setMaterialProgress(100);
                setPanelMessage("PDF replaced successfully.", "success");
                await ensureMaterialLoaded(true);
            } catch (error) {
                console.error("Study material replace failed", error);
                setPanelMessage(error.message || "Could not replace PDF.", "error");
            }
        });
        input.click();
    }

    async function deleteMaterial(id) {
        const note = findMaterial(id);
        if (!note || !window.confirm("Delete this study material PDF and database record?")) return;
        try {
            const client = window.VinayakAuth.getClient();
            await client.from("material_courses").delete().eq("note_id", id);
            const deleteResult = await client.from("notes").delete().eq("id", id);
            if (deleteResult.error) throw deleteResult.error;
            const key = getMaterialKey(note);
            if (key) {
                console.log("Deleting study material PDF from Cloudflare R2", { key: key });
                await deletePdfFromR2(key);
            }
            setPanelMessage("Study material deleted.", "success");
            await ensureMaterialLoaded(true);
        } catch (error) {
            console.error("Study material delete failed", error);
            setPanelMessage(error.message || "Could not delete study material.", "error");
        }
    }

    function getAnnouncementTitle(item) {
        return String((item && (item.title || item.heading)) || "Announcement");
    }

    function getAnnouncementContent(item) {
        return String((item && (item.content || item.message || item.description)) || "");
    }

    function getAnnouncementCourseIds(item) {
        const raw = item && (item.target_courses || item.course_ids || item.courses || item.course_id);
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
        if (typeof raw === "string") {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            } catch (error) {}
            return raw.split(",").map(function (entry) { return entry.trim(); }).filter(Boolean);
        }
        return [String(raw)];
    }

    function isAnnouncementAllCourses(item) {
        if (!item) return false;
        return item.all_courses === true || item.all_courses === "true" || item.target === "all" || item.audience === "all";
    }

    function getAnnouncementAudienceLabel(item) {
        if (isAnnouncementAllCourses(item)) return "All Courses";
        const ids = getAnnouncementCourseIds(item);
        const labels = ids.map(getCourseLabelById).filter(Boolean);
        return labels.length ? labels.join(", ") : "Selected Courses";
    }

    function setAnnouncementAllCoursesState() {
        const allInput = document.getElementById("announcementAllCoursesInput");
        const picker = document.getElementById("announcementCourseChecklist");
        const disabled = Boolean(allInput && allInput.checked);
        if (picker) {
            picker.classList.toggle("is-disabled", disabled);
            picker.querySelectorAll("input").forEach(function (input) {
                input.disabled = disabled;
            });
        }
    }

    function clearAnnouncementForm() {
        const form = document.getElementById("announcementForm");
        if (form) form.reset();
        setValue("announcementRecordId", "");
        const editor = document.getElementById("announcementContentInput");
        if (editor) editor.innerHTML = "";
        const allInput = document.getElementById("announcementAllCoursesInput");
        if (allInput) allInput.checked = true;
        renderAnnouncementCourseChecklist([]);
        setAnnouncementAllCoursesState();
    }

    function fillAnnouncementForm(id) {
        const item = announcementsCache.find(function (row) { return String(row.id) === String(id); });
        if (!item) return;
        setValue("announcementRecordId", item.id);
        setValue("announcementTitleInput", getAnnouncementTitle(item));
        setValue("announcementExpiryInput", item.expires_at ? String(item.expires_at).slice(0, 10) : "");
        const editor = document.getElementById("announcementContentInput");
        if (editor) editor.innerHTML = getAnnouncementContent(item);
        const pinned = document.getElementById("announcementPinnedInput");
        if (pinned) pinned.checked = Boolean(item.is_pinned || item.pinned);
        const allInput = document.getElementById("announcementAllCoursesInput");
        if (allInput) allInput.checked = isAnnouncementAllCourses(item);
        renderAnnouncementCourseChecklist(getAnnouncementCourseIds(item));
        setAnnouncementAllCoursesState();
        const form = document.getElementById("announcementForm");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderAnnouncementsAdmin() {
        const tbody = document.getElementById("announcementTableBody");
        if (!tbody) return;
        const query = getValue("announcementSearchInput").toLowerCase();
        const rows = announcementsCache.filter(function (item) {
            return !query || [getAnnouncementTitle(item), getAnnouncementContent(item), getAnnouncementAudienceLabel(item)].join(" ").toLowerCase().includes(query);
        }).sort(function (a, b) {
            const pinnedDiff = Number(Boolean(b.is_pinned || b.pinned)) - Number(Boolean(a.is_pinned || a.pinned));
            if (pinnedDiff) return pinnedDiff;
            return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        });
        const pageData = paginateRows(rows, "announcements");
        tbody.innerHTML = pageData.rows.length ? pageData.rows.map(function (item) {
            const pinned = Boolean(item.is_pinned || item.pinned);
            return [
                "<tr>",
                "<td><strong>", escapeHtml(getAnnouncementTitle(item)), "</strong><small>", escapeHtml(getAnnouncementContent(item).replace(/<[^>]+>/g, "").slice(0, 90)), "</small></td>",
                "<td>", escapeHtml(getAnnouncementAudienceLabel(item)), "</td>",
                '<td><span class="status-badge ', pinned ? "status-paid" : "status-due", '">', pinned ? "Pinned" : "Normal", "</span></td>",
                "<td>", escapeHtml(item.expires_at ? String(item.expires_at).slice(0, 10) : "No expiry"), "</td>",
                '<td><button type="button" class="table-action-btn" data-edit-announcement="', escapeHtml(item.id), '">Edit</button> ',
                '<button type="button" class="table-action-btn" data-toggle-announcement-pin="', escapeHtml(item.id), '">', pinned ? "Unpin" : "Pin", "</button> ",
                '<button type="button" class="table-action-btn danger-btn" data-delete-announcement="', escapeHtml(item.id), '">Delete</button></td>',
                "</tr>"
            ].join("");
        }).join("") : '<tr><td colspan="5" class="admin-empty">No announcements found.</td></tr>';
        renderPagination("announcementPagination", "announcements", pageData.page, pageData.totalPages, pageData.totalItems);
    }

    async function saveAnnouncement(event) {
        event.preventDefault();
        clearPanelMessage();
        const id = getValue("announcementRecordId");
        const editor = document.getElementById("announcementContentInput");
        const allInput = document.getElementById("announcementAllCoursesInput");
        const allCourses = Boolean(allInput && allInput.checked);
        const selectedCourses = allCourses ? [] : getSelectedAnnouncementCourseIds();
        const title = getValue("announcementTitleInput");
        const content = editor ? editor.innerHTML.trim() : "";
        if (!title || !content) {
            setPanelMessage("Enter announcement title and content.", "error");
            return;
        }
        if (!allCourses && !selectedCourses.length) {
            setPanelMessage("Select at least one target course or choose All Courses.", "error");
            return;
        }
        const payload = {
            title: title,
            content: content,
            message: content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            is_pinned: Boolean(document.getElementById("announcementPinnedInput") && document.getElementById("announcementPinnedInput").checked),
            all_courses: allCourses,
            target_courses: selectedCourses,
            expires_at: getValue("announcementExpiryInput") || null
        };
        if (!id) {
            payload.created_at = new Date().toISOString();
        }
        try {
            const client = window.VinayakAuth.getClient();
            const result = id
                ? await client.from("announcements").update(payload).eq("id", id)
                : await client.from("announcements").insert([payload]);
            if (result.error) throw result.error;
            setPanelMessage(id ? "Announcement updated." : "Announcement published.", "success");
            clearAnnouncementForm();
            await ensureAnnouncementsLoaded(true);
        } catch (error) {
            console.error("Announcement save failed", error);
            setPanelMessage(error.message || "Could not save announcement.", "error");
        }
    }

    async function toggleAnnouncementPin(id) {
        const item = announcementsCache.find(function (row) { return String(row.id) === String(id); });
        if (!item) return;
        try {
            const pinned = !Boolean(item.is_pinned || item.pinned);
            const result = await window.VinayakAuth.getClient().from("announcements").update({ is_pinned: pinned }).eq("id", id);
            if (result.error) throw result.error;
            await ensureAnnouncementsLoaded(true);
            setPanelMessage(pinned ? "Announcement pinned." : "Announcement unpinned.", "success");
        } catch (error) {
            console.error("Announcement pin update failed", error);
            setPanelMessage(error.message || "Could not update pinned state.", "error");
        }
    }

    async function deleteAnnouncement(id) {
        const item = announcementsCache.find(function (row) { return String(row.id) === String(id); });
        if (!item || !window.confirm("Delete announcement '" + getAnnouncementTitle(item) + "'?")) return;
        try {
            const result = await window.VinayakAuth.getClient().from("announcements").delete().eq("id", id);
            if (result.error) throw result.error;
            await ensureAnnouncementsLoaded(true);
            setPanelMessage("Announcement deleted.", "success");
        } catch (error) {
            console.error("Announcement delete failed", error);
            setPanelMessage(error.message || "Could not delete announcement.", "error");
        }
    }

    function getStoredAdminId() {
        try {
            const session = JSON.parse(window.localStorage.getItem("admin_session") || "{}");
            return session.adminId || session.username || "admin";
        } catch (error) {
            return "admin";
        }
    }

    function updateAttendanceControls() {
        const courseOptions = getCourseOptions();
        const uuidOptions = courseOptions.map(function (course) {
            return { value: course.id, label: course.name };
        });
        setSelectOptions("attendanceCourseInput", uuidOptions, "Select course", "No courses available");
        setFilterOptions("attendanceHistoryCourseFilter", uuidOptions, "All Courses");
    }

    function getAttendanceCourseLabel(courseId) {
        const match = getCourseOptions().find(function (course) {
            return String(course.id) === String(courseId);
        });
        return match ? match.name : String(courseId || "-");
    }

    function formatClock(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function formatDateTime(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString();
    }

    function attendanceStatusClass(status) {
        const normalized = String(status || "").toUpperCase();
        if (normalized === "PRESENT") return "status-paid";
        if (normalized === "ABSENT" || normalized === "AUTO_ABSENT") return "status-due";
        return "status-waiting";
    }

    function attendanceStatusLabel(status) {
        const normalized = String(status || "WAITING").toUpperCase();
        if (normalized === "AUTO_ABSENT") return "Auto Absent";
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }

    async function attendanceRequest(path, options) {
        const url = apiUrl(path);
        console.log("Attendance API URL", url);
        const response = await window.fetch(url, Object.assign({
            headers: { "Content-Type": "application/json" }
        }, options || {}));
        const payload = await response.json().catch(function () { return {}; });
        if (!response.ok || payload.success === false) {
            throw new Error(payload.message || payload.error || "Attendance request failed.");
        }
        return payload;
    }

    function getSelectedCourseName(selectId) {
        const select = document.getElementById(selectId);
        return select && select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : "";
    }

    async function startAttendance(event) {
        event.preventDefault();
        const payload = {
            course_id: getValue("attendanceCourseInput"),
            course_name: getSelectedCourseName("attendanceCourseInput"),
            subject: getValue("attendanceSubjectInput"),
            lecture_title: getValue("attendanceLectureTitleInput"),
            duration_minutes: Math.max(1, Math.floor(toNumber(getValue("attendanceDurationInput")) || 5)),
            created_by: getStoredAdminId()
        };
        if (!payload.course_id || !payload.subject || !payload.lecture_title) {
            setPanelMessage("Fill all attendance fields.", "error");
            return;
        }
        try {
            const button = document.getElementById("startAttendanceBtn");
            if (button) button.disabled = true;
            const result = await attendanceRequest("/api/attendance/start", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            activeAttendanceSessionId = result.session.id;
            setPanelMessage("Attendance started.", "success");
            renderLiveAttendance(result);
            startAttendancePolling();
            loadAttendanceHistory();
        } catch (error) {
            console.error("Attendance start failed", error);
            setPanelMessage(error.message || "Could not start attendance.", "error");
        } finally {
            const button = document.getElementById("startAttendanceBtn");
            if (button) button.disabled = false;
        }
    }

    function renderLiveAttendance(payload) {
        const session = payload.session || {};
        const summary = payload.summary || {};
        const rows = payload.students || [];
        const remaining = Number(payload.remaining_seconds || 0);
        setText("attendanceTotalStudents", summary.total_students || rows.length || 0);
        setText("attendancePresentCount", summary.present || 0);
        setText("attendanceAbsentCount", summary.absent || 0);
        setText("attendanceWaitingCount", summary.waiting || 0);
        setText("attendanceResponseCount", summary.live_responses || 0);
        setText("attendancePercentage", (summary.attendance_percentage || 0) + "%");
        setText("attendanceRemainingTime", session.status === "OPEN" ? formatClock(remaining) : "Closed");
        activeAttendanceEndTime = session.status === "OPEN" ? String(session.end_time || "") : "";
        if (activeAttendanceEndTime) {
            startAttendanceCountdown();
        } else {
            stopAttendanceCountdown();
        }
        setText("attendanceLiveMeta", session.id ? [
            session.lecture_title || "Lecture",
            getAttendanceCourseLabel(session.course_id),
            String(session.status || "").toUpperCase()
        ].join(" | ") : "No active attendance session.");
        const closeButton = document.getElementById("closeAttendanceBtn");
        if (closeButton) closeButton.disabled = !session.id || session.status !== "OPEN";
        const tbody = document.getElementById("attendanceLiveTableBody");
        if (tbody) {
            tbody.innerHTML = rows.length ? rows.map(function (row) {
                return "<tr><td>" + escapeHtml(row.student_name || "-") + "</td><td>" + escapeHtml(row.student_id || "-") + '</td><td><span class="status-badge ' + attendanceStatusClass(row.response) + '">' + escapeHtml(attendanceStatusLabel(row.response)) + "</span></td><td>" + escapeHtml(formatDateTime(row.response_time)) + "</td></tr>";
            }).join("") : '<tr><td colspan="4" class="admin-empty">No students found for this course.</td></tr>';
        }
        if (session.status !== "OPEN") {
            stopAttendancePolling();
            stopAttendanceCountdown();
            activeAttendanceSessionId = "";
            loadAttendanceHistory();
        }
    }

    async function refreshLiveAttendance() {
        if (!activeAttendanceSessionId) return;
        try {
            const result = await attendanceRequest("/api/attendance/live/" + encodeURIComponent(activeAttendanceSessionId));
            renderLiveAttendance(result);
        } catch (error) {
            console.error("Live attendance refresh failed", error);
            stopAttendancePolling();
            setPanelMessage(error.message || "Could not refresh live attendance.", "error");
        }
    }

    function startAttendancePolling() {
        stopAttendancePolling();
        startAttendanceRealtime();
        if (document.hidden) return;
        attendancePollTimer = window.setInterval(function () {
            if (!attendanceRealtimeActive) refreshLiveAttendance();
        }, 10000);
    }

    function stopAttendancePolling() {
        if (attendancePollTimer) {
            window.clearInterval(attendancePollTimer);
            attendancePollTimer = null;
        }
        stopAttendanceRealtime();
    }

    function startAttendanceRealtime() {
        stopAttendanceRealtime();
        if (!activeAttendanceSessionId || !window.VinayakAuth || typeof window.VinayakAuth.getClient !== "function") {
            return;
        }
        try {
            const client = window.VinayakAuth.getClient();
            if (!client || typeof client.channel !== "function") return;
            attendanceRealtimeActive = false;
            attendanceRealtimeChannel = client
                .channel("attendance-live-" + activeAttendanceSessionId)
                .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "attendance_responses",
                    filter: "session_id=eq." + activeAttendanceSessionId
                }, function (payload) {
                    console.log("Admin attendance realtime event received", payload);
                    refreshLiveAttendance();
                })
                .subscribe(function (status) {
                    console.log("Admin attendance realtime status", status);
                    attendanceRealtimeActive = status === "SUBSCRIBED";
                    if (attendanceRealtimeActive && attendancePollTimer) {
                        window.clearInterval(attendancePollTimer);
                        attendancePollTimer = null;
                    }
                });
        } catch (error) {
            console.warn("Admin attendance realtime setup failed; polling remains active.", error);
        }
    }

    function stopAttendanceRealtime() {
        if (!attendanceRealtimeChannel || !window.VinayakAuth || typeof window.VinayakAuth.getClient !== "function") {
            attendanceRealtimeChannel = null;
            return;
        }
        try {
            const client = window.VinayakAuth.getClient();
            if (client && typeof client.removeChannel === "function") {
                client.removeChannel(attendanceRealtimeChannel);
            }
        } catch (error) {
            console.warn("Admin attendance realtime cleanup failed", error);
        }
        attendanceRealtimeChannel = null;
        attendanceRealtimeActive = false;
    }

    function tickAttendanceCountdown() {
        if (!activeAttendanceEndTime) return;
        const seconds = Math.max(0, Math.ceil((new Date(activeAttendanceEndTime).getTime() - Date.now()) / 1000));
        setText("attendanceRemainingTime", formatClock(seconds));
        if (seconds === 0 && activeAttendanceSessionId) {
            refreshLiveAttendance();
        }
    }

    function startAttendanceCountdown() {
        if (document.hidden) return;
        if (!attendanceCountdownTimer) {
            attendanceCountdownTimer = window.setInterval(tickAttendanceCountdown, 1000);
        }
        tickAttendanceCountdown();
    }

    function stopAttendanceCountdown() {
        if (attendanceCountdownTimer) {
            window.clearInterval(attendanceCountdownTimer);
            attendanceCountdownTimer = null;
        }
        activeAttendanceEndTime = "";
    }

    function stopAttendanceRuntime() {
        stopAttendancePolling();
        if (attendanceCountdownTimer) {
            window.clearInterval(attendanceCountdownTimer);
            attendanceCountdownTimer = null;
        }
    }

    function handleAdminVisibilityChange() {
        if (!activeAttendanceSessionId) return;
        if (document.hidden) {
            stopAttendanceRuntime();
            return;
        }
        startAttendancePolling();
        if (activeAttendanceEndTime) startAttendanceCountdown();
        refreshLiveAttendance();
    }

    async function closeAttendance() {
        if (!activeAttendanceSessionId || attendanceClosing) return;
        attendanceClosing = true;
        try {
            const result = await attendanceRequest("/api/attendance/close", {
                method: "POST",
                body: JSON.stringify({ session_id: activeAttendanceSessionId })
            });
            renderLiveAttendance(result);
            setPanelMessage("Attendance closed. Pending students remain Not Responded.", "success");
        } catch (error) {
            console.error("Attendance close failed", error);
            setPanelMessage(error.message || "Could not close attendance.", "error");
        } finally {
            attendanceClosing = false;
        }
    }

    async function loadAttendanceHistory() {
        const params = new URLSearchParams();
        if (getValue("attendanceHistoryCourseFilter")) params.set("course_id", getValue("attendanceHistoryCourseFilter"));
        if (getValue("attendanceHistoryDateFilter")) params.set("date", getValue("attendanceHistoryDateFilter"));
        try {
            const result = await attendanceRequest("/api/attendance/history" + (params.toString() ? "?" + params.toString() : ""));
            attendanceHistoryCache = result.sessions || [];
            renderAttendanceHistory();
        } catch (error) {
            console.error("Attendance history failed", error);
            const tbody = document.getElementById("attendanceHistoryTableBody");
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">' + escapeHtml(error.message || "Could not load attendance history.") + "</td></tr>";
        }
    }

    function renderAttendanceHistory() {
        const tbody = document.getElementById("attendanceHistoryTableBody");
        if (!tbody) return;
        const pageData = paginateRows(attendanceHistoryCache, "attendanceHistory");
        tbody.innerHTML = pageData.rows.length ? pageData.rows.map(function (session) {
            return "<tr><td>" + escapeHtml(formatDateTime(session.start_time)) + "</td><td>" + escapeHtml(getAttendanceCourseLabel(session.course_id)) + "</td><td>" + escapeHtml(session.lecture_title || "-") + '</td><td><span class="status-badge ' + (session.status === "OPEN" ? "status-waiting" : "status-paid") + '">' + escapeHtml(session.status || "-") + '</span></td><td><button type="button" class="table-action-btn" data-view-attendance-report="' + escapeHtml(session.id) + '"><i class="fas fa-eye"></i> View</button></td></tr>';
        }).join("") : '<tr><td colspan="5" class="admin-empty">No attendance sessions found.</td></tr>';
        renderPagination("attendanceHistoryPagination", "attendanceHistory", pageData.page, pageData.totalPages, pageData.totalItems);
    }

    async function viewAttendanceReport(sessionId) {
        try {
            const result = await attendanceRequest("/api/attendance/report/" + encodeURIComponent(sessionId));
            attendanceReportCache = result;
            renderAttendanceReport();
            const card = document.getElementById("attendanceReportCard");
            if (card) {
                card.hidden = false;
                card.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        } catch (error) {
            console.error("Attendance report failed", error);
            setPanelMessage(error.message || "Could not load attendance report.", "error");
        }
    }

    function renderAttendanceReport() {
        const session = attendanceReportCache && attendanceReportCache.session ? attendanceReportCache.session : {};
        const rows = attendanceReportCache && attendanceReportCache.students ? attendanceReportCache.students : [];
        setText("attendanceReportMeta", session.id ? [
            session.lecture_title || "Lecture",
            getAttendanceCourseLabel(session.course_id),
            formatDateTime(session.start_time)
        ].join(" | ") : "Select a session to view report.");
        const tbody = document.getElementById("attendanceReportTableBody");
        if (!tbody) return;
        tbody.innerHTML = rows.length ? rows.map(function (row) {
            return "<tr><td>" + escapeHtml(row.student_name || "-") + "</td><td>" + escapeHtml(row.student_id || "-") + '</td><td><span class="status-badge ' + attendanceStatusClass(row.response) + '">' + escapeHtml(attendanceStatusLabel(row.response)) + "</span></td><td>" + escapeHtml(formatDateTime(row.response_time)) + "</td></tr>";
        }).join("") : '<tr><td colspan="4" class="admin-empty">No report rows found.</td></tr>';
    }

    function exportAttendanceExcel() {
        if (!attendanceReportCache || !attendanceReportCache.students) {
            setPanelMessage("Open an attendance report before export.", "error");
            return;
        }
        const rows = attendanceReportCache.students.map(function (row) {
            return {
                "Student Name": row.student_name || "",
                "Student ID": row.student_id || "",
                "Status": attendanceStatusLabel(row.response),
                "Response Time": formatDateTime(row.response_time)
            };
        });
        if (window.XLSX) {
            const worksheet = window.XLSX.utils.json_to_sheet(rows);
            const workbook = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
            window.XLSX.writeFile(workbook, "attendance-" + attendanceReportCache.session.id + ".xlsx");
            return;
        }
        const csv = ["Student Name,Student ID,Status,Response Time"].concat(rows.map(function (row) {
            return [row["Student Name"], row["Student ID"], row.Status, row["Response Time"]].map(function (cell) {
                return '"' + String(cell).replace(/"/g, '""') + '"';
            }).join(",");
        })).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "attendance-" + attendanceReportCache.session.id + ".csv";
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function exportAttendancePdf() {
        if (!attendanceReportCache || !attendanceReportCache.students) {
            setPanelMessage("Open an attendance report before export.", "error");
            return;
        }
        const session = attendanceReportCache.session || {};
        const rows = attendanceReportCache.students.map(function (row) {
            return "<tr><td>" + escapeHtml(row.student_name || "-") + "</td><td>" + escapeHtml(row.student_id || "-") + "</td><td>" + escapeHtml(attendanceStatusLabel(row.response)) + "</td><td>" + escapeHtml(formatDateTime(row.response_time)) + "</td></tr>";
        }).join("");
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            setPanelMessage("Allow popups to export PDF.", "error");
            return;
        }
        printWindow.document.write("<!doctype html><html><head><title>Attendance Report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#f3f4f6}h1{margin:0 0 8px}</style></head><body><h1>Attendance Report</h1><p>" + escapeHtml(session.lecture_title || "Lecture") + " | " + escapeHtml(getAttendanceCourseLabel(session.course_id)) + " | " + escapeHtml(formatDateTime(session.start_time)) + "</p><table><thead><tr><th>Student Name</th><th>Student ID</th><th>Status</th><th>Response Time</th></tr></thead><tbody>" + rows + "</tbody></table><script>window.onload=function(){window.print();};<\/script></body></html>");
        printWindow.document.close();
    }

    async function refreshAll() {
        studentsCache = await fetchStudents();
        feesCache = await fetchTable("student_fees");
        emisCache = await fetchTable("emis", { orderBy: "due_date", ascending: true });
        paymentsCache = await fetchOptionalTable("payments");
        batchesCache = await fetchOptionalTable("batches");
        try {
            await loadMaterialManagerRows();
        } catch (error) {
            console.error("R2 study material preload failed", error);
            notesCache = [];
            materialCoursesCache = [];
        }
        announcementsCache = await fetchOptionalTable("announcements");
        loadedAdminTables.payments = true;
        loadedAdminTables.material = true;
        loadedAdminTables.announcements = true;
        await loadCourses();
        updateBatchFilter();
        applyStudentFilter();
        renderEmis();
        renderDashboard();
        renderMaterials();
        renderAnnouncementsAdmin();
        updateAttendanceControls();
    }

    function setupAdmissionDefaults() {
        currentAdmissionStep = 1;
        setValue("newStudentId", generateStudentId());
        setValue("newAdmissionDate", getTodayDateString());
        setValue("newAccountStatus", "active");
        setValue("newTotalFee", "");
        setValue("newAdmissionFee", "");
        updateRemainingFee();
        renderAdmissionEmis([], false);
        renderAdmissionWizard();
    }

    function addManualEmiRow() {
        const current = readManualEmis();
        current.push({ emi_number: current.length + 1, amount: 0, due_date: "", status: "pending" });
        renderAdmissionEmis(current, true);
    }

    function validateAdmissionStep(step) {
        const panel = document.querySelector('[data-admission-step-panel="' + step + '"]');
        if (!panel) {
            return true;
        }
        const fields = panel.querySelectorAll("input, select, textarea");
        for (let index = 0; index < fields.length; index += 1) {
            if (!fields[index].checkValidity()) {
                fields[index].reportValidity();
                return false;
            }
        }
        return true;
    }

    function renderAdmissionWizard() {
        document.querySelectorAll("[data-admission-step-panel]").forEach(function (panel) {
            panel.hidden = String(panel.getAttribute("data-admission-step-panel")) !== String(currentAdmissionStep);
        });
        document.querySelectorAll("[data-admission-step-nav]").forEach(function (nav) {
            nav.hidden = String(nav.getAttribute("data-admission-step-nav")) !== String(currentAdmissionStep);
        });
        document.querySelectorAll("[data-admission-step-indicator]").forEach(function (stepNode) {
            const stepNumber = Number(stepNode.getAttribute("data-admission-step-indicator"));
            stepNode.classList.toggle("active", stepNumber === currentAdmissionStep);
            stepNode.classList.toggle("complete", stepNumber < currentAdmissionStep);
        });
    }

    function setAdmissionStep(step) {
        currentAdmissionStep = Math.max(1, Math.min(4, Number(step) || 1));
        renderAdmissionWizard();
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
            const pageButton = event.target.closest("[data-pagination-key]");
            if (pageButton) {
                paginationState[pageButton.getAttribute("data-pagination-key")] = Number(pageButton.getAttribute("data-pagination-page")) || 1;
                if (pageButton.getAttribute("data-pagination-key") === "students") applyStudentFilter(false);
                if (pageButton.getAttribute("data-pagination-key") === "emi") renderEmis();
                if (pageButton.getAttribute("data-pagination-key") === "bulk") renderBulkRows();
                if (pageButton.getAttribute("data-pagination-key") === "material") renderMaterials();
                if (pageButton.getAttribute("data-pagination-key") === "announcements") renderAnnouncementsAdmin();
                if (pageButton.getAttribute("data-pagination-key") === "attendanceHistory") renderAttendanceHistory();
            }
            const previewMaterialButton = event.target.closest("[data-preview-material]");
            if (previewMaterialButton) previewMaterial(previewMaterialButton.getAttribute("data-preview-material"));
            const editMaterialButton = event.target.closest("[data-edit-material]");
            if (editMaterialButton) editMaterial(editMaterialButton.getAttribute("data-edit-material"));
            const moveMaterialSubjectButton = event.target.closest("[data-move-material-subject]");
            if (moveMaterialSubjectButton) moveMaterialSubject(moveMaterialSubjectButton.getAttribute("data-move-material-subject"));
            const editMaterialCoursesButton = event.target.closest("[data-edit-material-courses]");
            if (editMaterialCoursesButton) editMaterialCourses(editMaterialCoursesButton.getAttribute("data-edit-material-courses"));
            const removeMaterialCourseButton = event.target.closest("[data-remove-material-course]");
            if (removeMaterialCourseButton) removeMaterialCourse(removeMaterialCourseButton.getAttribute("data-remove-material-course"));
            const replaceMaterialButton = event.target.closest("[data-replace-material]");
            if (replaceMaterialButton) replaceMaterial(replaceMaterialButton.getAttribute("data-replace-material"));
            const copyR2LinkButton = event.target.closest("[data-copy-r2-link]");
            if (copyR2LinkButton) copyMaterialR2Link(copyR2LinkButton.getAttribute("data-copy-r2-link"));
            const deleteMaterialButton = event.target.closest("[data-delete-material]");
            if (deleteMaterialButton) deleteMaterial(deleteMaterialButton.getAttribute("data-delete-material"));
            const editCourseButton = event.target.closest("[data-edit-course]");
            if (editCourseButton) fillCourseForm(editCourseButton.getAttribute("data-edit-course"));
            const deleteCourseButton = event.target.closest("[data-delete-course]");
            if (deleteCourseButton) deleteCourse(deleteCourseButton.getAttribute("data-delete-course"));
            const editAnnouncementButton = event.target.closest("[data-edit-announcement]");
            if (editAnnouncementButton) fillAnnouncementForm(editAnnouncementButton.getAttribute("data-edit-announcement"));
            const toggleAnnouncementButton = event.target.closest("[data-toggle-announcement-pin]");
            if (toggleAnnouncementButton) toggleAnnouncementPin(toggleAnnouncementButton.getAttribute("data-toggle-announcement-pin"));
            const deleteAnnouncementButton = event.target.closest("[data-delete-announcement]");
            if (deleteAnnouncementButton) deleteAnnouncement(deleteAnnouncementButton.getAttribute("data-delete-announcement"));
            const attendanceReportButton = event.target.closest("[data-view-attendance-report]");
            if (attendanceReportButton) viewAttendanceReport(attendanceReportButton.getAttribute("data-view-attendance-report"));
        });
        document.getElementById("adminMenuBtn").addEventListener("click", function () {
            if (window.innerWidth <= 1024) {
                document.body.classList.toggle("admin-sidebar-open");
                return;
            }
            document.body.classList.toggle("admin-sidebar-collapsed");
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
        document.getElementById("emiSearchInput").addEventListener("input", function () {
            paginationState.emi = 1;
            renderEmis();
        });
        document.getElementById("validateImportBtn").addEventListener("click", validateBulkImport);
        document.getElementById("importStudentsBtn").addEventListener("click", importBulkStudents);
        document.getElementById("downloadSampleCsvBtn").addEventListener("click", downloadSampleCsv);
        document.getElementById("downloadSampleExcelBtn").addEventListener("click", downloadSampleExcel);
        document.getElementById("bulkSearchInput").addEventListener("input", function () {
            paginationState.bulk = 1;
            renderBulkRows();
        });
        document.getElementById("exportStudentsCsvBtn").addEventListener("click", exportStudentsCsv);
        document.getElementById("exportStudentsExcelBtn").addEventListener("click", exportStudentsExcel);
        document.getElementById("adminGlobalSearch").addEventListener("input", function () {
            setValue("studentSearchInput", getValue("adminGlobalSearch"));
            showAdminSection("students");
            applyStudentFilter();
        });
        const materialForm = document.getElementById("materialUploadForm");
        if (materialForm) materialForm.addEventListener("submit", uploadStudyMaterial);
        const materialFileInput = document.getElementById("materialFileInput");
        const materialFolderInput = document.getElementById("materialFolderInput");
        const selectMaterialFilesButton = document.getElementById("selectMaterialFilesBtn");
        const selectMaterialFolderButton = document.getElementById("selectMaterialFolderBtn");
        const materialDropzone = document.getElementById("materialDropzone");
        const retryFailedMaterialButton = document.getElementById("retryFailedMaterialBtn");
        const cancelMaterialUploadButton = document.getElementById("cancelMaterialUploadBtn");
        if (selectMaterialFilesButton && materialFileInput) selectMaterialFilesButton.addEventListener("click", function () { materialFileInput.click(); });
        if (selectMaterialFolderButton && materialFolderInput) selectMaterialFolderButton.addEventListener("click", function () { materialFolderInput.click(); });
        if (materialFileInput) materialFileInput.addEventListener("change", function () { addMaterialFiles(materialFileInput.files); });
        if (materialFolderInput) materialFolderInput.addEventListener("change", function () { addMaterialFiles(materialFolderInput.files); });
        if (retryFailedMaterialButton && materialForm) retryFailedMaterialButton.addEventListener("click", function () { materialForm.requestSubmit(); });
        if (cancelMaterialUploadButton) cancelMaterialUploadButton.addEventListener("click", cancelMaterialUploads);
        if (materialDropzone) {
            ["dragenter", "dragover"].forEach(function (type) {
                materialDropzone.addEventListener(type, function (event) {
                    event.preventDefault();
                    materialDropzone.classList.add("is-dragging");
                });
            });
            ["dragleave", "drop"].forEach(function (type) {
                materialDropzone.addEventListener(type, function (event) {
                    event.preventDefault();
                    materialDropzone.classList.remove("is-dragging");
                });
            });
            materialDropzone.addEventListener("drop", function (event) {
                addMaterialFiles(event.dataTransfer ? event.dataTransfer.files : []);
            });
        }
        const courseForm = document.getElementById("courseForm");
        if (courseForm) courseForm.addEventListener("submit", saveCourse);
        const clearCourseButton = document.getElementById("clearCourseFormBtn");
        if (clearCourseButton) clearCourseButton.addEventListener("click", clearCourseForm);
        const courseSearchInput = document.getElementById("courseSearchInput");
        if (courseSearchInput) courseSearchInput.addEventListener("input", renderCourses);
        const announcementForm = document.getElementById("announcementForm");
        if (announcementForm) announcementForm.addEventListener("submit", saveAnnouncement);
        const clearAnnouncementButton = document.getElementById("clearAnnouncementFormBtn");
        if (clearAnnouncementButton) clearAnnouncementButton.addEventListener("click", clearAnnouncementForm);
        const announcementSearchInput = document.getElementById("announcementSearchInput");
        if (announcementSearchInput) announcementSearchInput.addEventListener("input", function () {
            paginationState.announcements = 1;
            renderAnnouncementsAdmin();
        });
        const announcementAllCoursesInput = document.getElementById("announcementAllCoursesInput");
        if (announcementAllCoursesInput) announcementAllCoursesInput.addEventListener("change", setAnnouncementAllCoursesState);
        const attendanceStartForm = document.getElementById("attendanceStartForm");
        if (attendanceStartForm) attendanceStartForm.addEventListener("submit", startAttendance);
        const closeAttendanceButton = document.getElementById("closeAttendanceBtn");
        if (closeAttendanceButton) closeAttendanceButton.addEventListener("click", closeAttendance);
        ["attendanceHistoryCourseFilter", "attendanceHistoryDateFilter"].forEach(function (id) {
            const field = document.getElementById(id);
            if (!field) return;
            field.addEventListener("input", function () {
                paginationState.attendanceHistory = 1;
                loadAttendanceHistory();
            });
            field.addEventListener("change", function () {
                paginationState.attendanceHistory = 1;
                loadAttendanceHistory();
            });
        });
        const exportAttendanceExcelButton = document.getElementById("exportAttendanceExcelBtn");
        if (exportAttendanceExcelButton) exportAttendanceExcelButton.addEventListener("click", exportAttendanceExcel);
        const exportAttendancePdfButton = document.getElementById("exportAttendancePdfBtn");
        if (exportAttendancePdfButton) exportAttendancePdfButton.addEventListener("click", exportAttendancePdf);
        document.querySelectorAll("[data-announcement-command]").forEach(function (button) {
            button.addEventListener("click", function () {
                document.execCommand(button.getAttribute("data-announcement-command"), false, null);
                const editor = document.getElementById("announcementContentInput");
                if (editor) editor.focus();
            });
        });
        const announcementLinkButton = document.querySelector("[data-announcement-link]");
        if (announcementLinkButton) {
            announcementLinkButton.addEventListener("click", function () {
                const url = window.prompt("Paste link URL");
                if (url) document.execCommand("createLink", false, url);
            });
        }
        ["materialSearchInput", "materialCourseFilter", "materialSubjectFilter", "materialDateFilter"].forEach(function (id) {
            const field = document.getElementById(id);
            if (!field) return;
            field.addEventListener("input", function () {
                paginationState.material = 1;
                renderMaterials();
            });
            field.addEventListener("change", function () {
                paginationState.material = 1;
                renderMaterials();
            });
        });
        document.querySelectorAll("[data-admission-next]").forEach(function (button) {
            button.addEventListener("click", function () {
                if (!validateAdmissionStep(currentAdmissionStep)) {
                    return;
                }
                setAdmissionStep(button.getAttribute("data-admission-next"));
            });
        });
        document.querySelectorAll("[data-admission-prev]").forEach(function (button) {
            button.addEventListener("click", function () {
                setAdmissionStep(button.getAttribute("data-admission-prev"));
            });
        });
        document.addEventListener("visibilitychange", handleAdminVisibilityChange);
        window.addEventListener("pagehide", stopAttendanceRuntime);
    }

    document.addEventListener("DOMContentLoaded", async function () {
        try {
            await window.VinayakAuth.initProtectedPage({ adminOnly: true });
            initLucideIcons();
            bindEvents();
            setupAdmissionDefaults();
            renderAdmissionWizard();
            await refreshAll();
            initLucideIcons();
        } catch (error) {
            console.error("Admin panel init failed", error);
            setPanelMessage(error.message || "Admin panel could not load.", "error");
        }
    });
}());
