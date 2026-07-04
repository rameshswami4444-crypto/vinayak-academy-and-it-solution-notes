(function () {
    const root = document;
    const illustration = root.querySelector(".prototype-illustration");
    const studentPassword = root.getElementById("studentPassword");
    const adminPassword = root.getElementById("adminPassword");
    const studentForm = root.getElementById("studentLoginForm");
    const adminForm = root.getElementById("adminLoginForm");
    const studentButton = root.getElementById("studentLoginButton");
    const adminButton = root.getElementById("adminLoginButton");
    const studentMessage = root.getElementById("studentAuthMessage");
    const adminMessage = root.getElementById("adminAuthMessage");
    const mascotFront = root.querySelector('[data-mascot-face="front"]');
    const allPupils = Array.from(root.querySelectorAll("[data-pupil]"));
    const allLids = Array.from(root.querySelectorAll("[data-lid]"));

    if (!illustration || !window.gsap || !allPupils.length || !allLids.length) {
        return;
    }

    const gsap = window.gsap;
    const pupilStates = allPupils.map(function (pupil) {
        const cx = Number(pupil.getAttribute("cx") || 0);
        const cy = Number(pupil.getAttribute("cy") || 0);
        return {
            node: pupil,
            baseX: cx,
            baseY: cy,
            x: cx,
            y: cy,
            targetX: cx,
            targetY: cy
        };
    });

    let trackingEnabled = true;
    let rafId = 0;
    let pointerInside = false;
    let passwordFocused = false;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function ensureTick() {
        if (!rafId) {
            rafId = window.requestAnimationFrame(tick);
        }
    }

    function setTargetsToBase() {
        pupilStates.forEach(function (state) {
            state.targetX = state.baseX;
            state.targetY = state.baseY;
        });
    }

    function setPupilTargets(clientX, clientY) {
        const matrix = illustration.getScreenCTM();
        if (!matrix) {
            return;
        }
        const point = illustration.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const transformed = point.matrixTransform(matrix.inverse());

        pupilStates.forEach(function (state) {
            const dx = transformed.x - state.baseX;
            const dy = transformed.y - state.baseY;
            const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const maxOffset = 7.5;
            const offsetX = clamp((dx / distance) * maxOffset, -maxOffset, maxOffset);
            const offsetY = clamp((dy / distance) * maxOffset, -maxOffset, maxOffset);
            state.targetX = state.baseX + offsetX;
            state.targetY = state.baseY + offsetY;
        });
    }

    function tick() {
        let pending = false;
        pupilStates.forEach(function (state) {
            state.x += (state.targetX - state.x) * 0.16;
            state.y += (state.targetY - state.y) * 0.16;
            state.node.setAttribute("cx", state.x.toFixed(2));
            state.node.setAttribute("cy", state.y.toFixed(2));
            if (Math.abs(state.targetX - state.x) > 0.05 || Math.abs(state.targetY - state.y) > 0.05) {
                pending = true;
            }
        });

        if (pending) {
            rafId = window.requestAnimationFrame(tick);
        } else {
            rafId = 0;
        }
    }

    function openEyes() {
        trackingEnabled = true;
        gsap.to(allLids, {
            attr: { height: 0 },
            duration: 0.2,
            ease: "power2.out"
        });
        ensureTick();
    }

    function closeEyes() {
        trackingEnabled = false;
        setTargetsToBase();
        gsap.to(allLids, {
            attr: function (_, target) {
                return { height: Number(target.getAttribute("data-lid-closed") || 20) };
            },
            duration: 0.18,
            ease: "power2.inOut"
        });
        ensureTick();
    }

    function pressButton(button) {
        if (!button) {
            return;
        }
        gsap.fromTo(button, {
            scale: 1
        }, {
            scale: 0.97,
            duration: 0.09,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });
    }

    function bounceMascot() {
        if (!mascotFront) {
            return;
        }
        gsap.killTweensOf(mascotFront);
        gsap.fromTo(mascotFront, {
            y: 0,
            rotation: 0,
            transformOrigin: "50% 100%"
        }, {
            y: -10,
            duration: 0.16,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });
    }

    function playSuccess() {
        bounceMascot();
        gsap.fromTo(illustration, {
            filter: "drop-shadow(0 0 0 rgba(58, 253, 129, 0))"
        }, {
            filter: "drop-shadow(0 0 16px rgba(34, 197, 94, 0.38))",
            duration: 0.18,
            yoyo: true,
            repeat: 1,
            ease: "power1.out"
        });
    }

    function playFail() {
        if (mascotFront) {
            gsap.killTweensOf(mascotFront);
            gsap.fromTo(mascotFront, {
                rotation: 0,
                transformOrigin: "50% 100%"
            }, {
                rotation: 5,
                duration: 0.12,
                ease: "power1.out",
                yoyo: true,
                repeat: 3
            });
        }
        closeEyes();
        window.setTimeout(function () {
            if (!passwordFocused) {
                openEyes();
            }
        }, 220);
    }

    function onPointerMove(event) {
        if (!trackingEnabled) {
            return;
        }
        pointerInside = true;
        setPupilTargets(event.clientX, event.clientY);
        ensureTick();
    }

    function onTouchMove(event) {
        const touch = event.touches && event.touches[0];
        if (!touch) {
            return;
        }
        onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    function onPointerLeave() {
        pointerInside = false;
        setTargetsToBase();
        ensureTick();
    }

    function bindPasswordField(field) {
        if (!field) {
            return;
        }
        field.addEventListener("focus", function () {
            passwordFocused = true;
            closeEyes();
        });
        field.addEventListener("input", function () {
            passwordFocused = true;
            closeEyes();
        });
        field.addEventListener("blur", function () {
            passwordFocused = false;
            openEyes();
            if (!pointerInside) {
                setTargetsToBase();
            }
        });
    }

    function bindFormFeedback(form, button) {
        if (!form) {
            return;
        }
        form.addEventListener("submit", function () {
            pressButton(button);
            if (form.checkValidity()) {
                playSuccess();
            }
        });
    }

    function watchMessage(node) {
        if (!node) {
            return;
        }
        const observer = new MutationObserver(function () {
            if (!node.hidden && String(node.textContent || "").trim()) {
                playFail();
            }
        });
        observer.observe(node, {
            attributes: true,
            attributeFilter: ["hidden", "class"],
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    function bindShowPasswordToggles() {
        root.querySelectorAll(".prototype-password-row .prototype-eye").forEach(function (button) {
            button.addEventListener("click", function () {
                const input = button.parentElement && button.parentElement.querySelector("input");
                if (!input) {
                    return;
                }
                input.type = input.type === "password" ? "text" : "password";
            });
        });
    }

    window.prototypeMascot = {
        playSuccess: playSuccess,
        playFail: playFail,
        closeEyes: closeEyes,
        openEyes: openEyes
    };

    setTargetsToBase();
    ensureTick();

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchstart", onTouchMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("touchend", onPointerLeave, { passive: true });
    window.addEventListener("touchcancel", onPointerLeave, { passive: true });
    bindPasswordField(studentPassword);
    bindPasswordField(adminPassword);
    bindFormFeedback(studentForm, studentButton);
    bindFormFeedback(adminForm, adminButton);
    watchMessage(studentMessage);
    watchMessage(adminMessage);
    bindShowPasswordToggles();
}());
