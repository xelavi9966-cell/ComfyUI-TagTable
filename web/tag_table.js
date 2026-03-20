import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "Lera.TagTableNode",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "TagTableNode") {
            return;
        }

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnConfigure = nodeType.prototype.onConfigure;

        nodeType.prototype.onNodeCreated = function () {
            const result = originalOnNodeCreated
                ? originalOnNodeCreated.apply(this, arguments)
                : undefined;

            setupTagTable.call(this);
            return result;
        };

        nodeType.prototype.onConfigure = function () {
            const result = originalOnConfigure
                ? originalOnConfigure.apply(this, arguments)
                : undefined;

            if (this.__tagTableRefresh) {
                requestAnimationFrame(() => this.__tagTableRefresh?.());
            }

            return result;
        };

        function setupTagTable() {
            const rowsWidget = this.widgets?.find(w => w.name === "rows");
            const tableDataWidget = this.widgets?.find(w => w.name === "table_data");

            if (!rowsWidget || !tableDataWidget) {
                return;
            }

            if (this.__tagTableInitialized) {
                this.__tagTableRefresh?.();
                return;
            }
            this.__tagTableInitialized = true;

            tableDataWidget.hidden = true;
            this.properties = this.properties || {};

            const MIN_WIDTH = 620;
            const MIN_HEIGHT = 320;
            const SIZE_STEP = 10;
            const DEFAULT_WIDTH = 760;
            const DEFAULT_HEIGHT = 520;

            const safeParseArray = (value) => {
                try {
                    const parsed = JSON.parse(value || "[]");
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            };

            const snapSize = (value, minValue) => {
                const n = Number(value);
                if (!Number.isFinite(n)) return minValue;
                return Math.max(minValue, Math.round(n / SIZE_STEP) * SIZE_STEP);
            };

            const loadState = () => {
                let data = safeParseArray(this.properties.tag_table_data);
                if (!data.length) {
                    data = safeParseArray(tableDataWidget.value);
                }

                return data.map(row => ({
                    enabled: row?.enabled !== false,
                    tag: String(row?.tag ?? ""),
                    comment: String(row?.comment ?? "")
                }));
            };

            let state = loadState();
            let rowRefs = [];
            let dragIndex = null;
            let saveTimer = null;
            let layoutQueued = false;

            let preferredWidth = snapSize(
                Number(this.properties?.tag_table_width) ||
                (Array.isArray(this.size) ? this.size[0] : DEFAULT_WIDTH),
                MIN_WIDTH
            );

            let preferredHeight = snapSize(
                Number(this.properties?.tag_table_height) ||
                (Array.isArray(this.size) ? this.size[1] : DEFAULT_HEIGHT),
                MIN_HEIGHT
            );

            const ensureRowCount = (count) => {
                while (state.length < count) {
                    state.push({
                        enabled: true,
                        tag: "",
                        comment: ""
                    });
                }

                while (state.length > count) {
                    state.pop();
                }
            };

            const buildFinalPrompt = () => {
                return state
                    .filter(row => row.enabled && String(row.tag || "").trim())
                    .map(row => String(row.tag || "").trim())
                    .join(" ");
            };

            const autoResizeTextarea = (textarea) => {
                if (!textarea) return;
                textarea.style.height = "auto";
                textarea.style.height = Math.max(textarea.scrollHeight, 30) + "px";
            };

            const syncSingleRowHeight = (tagInput, commentInput) => {
                autoResizeTextarea(tagInput);
                autoResizeTextarea(commentInput);

                const rowHeight = Math.max(
                    tagInput?.scrollHeight || 30,
                    commentInput?.scrollHeight || 30,
                    30
                );

                if (tagInput) tagInput.style.height = `${rowHeight}px`;
                if (commentInput) commentInput.style.height = `${rowHeight}px`;
            };

            const persistState = () => {
                const json = JSON.stringify(state);

                tableDataWidget.value = json;
                this.properties.tag_table_data = json;
                this.properties.tag_table_rows = Number(rowsWidget.value || 1);
                this.properties.tag_table_width = preferredWidth;
                this.properties.tag_table_height = preferredHeight;

                if (tableDataWidget.callback) {
                    tableDataWidget.callback(tableDataWidget.value);
                }

                this.setDirtyCanvas(true, true);
                app.graph.setDirtyCanvas(true, true);
            };

            const queueSave = () => {
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => {
                    persistState();
                }, 120);
            };

            const applyNodeSize = () => {
                const currentWidth = Array.isArray(this.size) ? this.size[0] : 0;
                const currentHeight = Array.isArray(this.size) ? this.size[1] : 0;

                if (
                    Math.abs(currentWidth - preferredWidth) > 1 ||
                    Math.abs(currentHeight - preferredHeight) > 1
                ) {
                    this.setSize([preferredWidth, preferredHeight]);
                    this.setDirtyCanvas(true, true);
                    app.graph.setDirtyCanvas(true, true);
                }
            };

            const queueLayout = () => {
                if (layoutQueued) return;
                layoutQueued = true;

                requestAnimationFrame(() => {
                    layoutQueued = false;

                    for (const ref of rowRefs) {
                        syncSingleRowHeight(ref.tagInput, ref.commentInput);
                    }

                    finalPromptArea.value = buildFinalPrompt();
                    autoResizeTextarea(finalPromptArea);

                    this.setDirtyCanvas(true, true);
                    app.graph.setDirtyCanvas(true, true);
                });
            };

            const root = document.createElement("div");
            root.style.display = "flex";
            root.style.flexDirection = "column";
            root.style.gap = "6px";
            root.style.padding = "6px";
            root.style.minWidth = "520px";
            root.style.width = "100%";
            root.style.boxSizing = "border-box";
            root.style.overflow = "visible";

            const styleBlock = document.createElement("style");
            styleBlock.textContent = `
                .lera-tt-header-row,
                .lera-tt-row {
                    display: grid;
                    grid-template-columns: 26px 52px minmax(0, 1fr) minmax(0, 1fr) 30px;
                    gap: 6px;
                    width: 100%;
                    box-sizing: border-box;
                    align-items: start;
                }
                .lera-tt-header-row {
                    font-weight: 700;
                }
                .lera-tt-row {
                    border-radius: 4px;
                }
                .lera-tt-row.is-disabled textarea,
                .lera-tt-row.is-disabled .lera-tt-drag,
                .lera-tt-row.is-disabled .lera-tt-delete-btn {
                    opacity: 0.45;
                }
                .lera-tt-row.is-dragover {
                    background: rgba(122,162,255,0.10);
                    outline: 1px solid #7aa2ff;
                }
                .lera-tt-drag {
                    cursor: grab;
                    user-select: none;
                    text-align: center;
                    padding-top: 6px;
                    font-size: 14px;
                    opacity: 0.8;
                }
                .lera-tt-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 30px;
                }
                .lera-tt-toggle input {
                    transform: scale(1.05);
                }
                .lera-tt-input,
                .lera-tt-note {
                    width: 100%;
                    min-height: 30px;
                    font: inherit;
                    line-height: 1.25;
                    padding: 4px 6px;
                    border-radius: 4px;
                    border: 1px solid var(--border-color, #666);
                    background: var(--comfy-input-bg, rgba(0,0,0,0.20));
                    color: var(--input-text, inherit);
                    box-sizing: border-box;
                    resize: none;
                    overflow: hidden;
                    display: block;
                    white-space: pre-wrap;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                }
                .lera-tt-preview-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    margin-top: 8px;
                }
                .lera-tt-copy-btn {
                    font: inherit;
                    font-size: 12px;
                    line-height: 1;
                    padding: 6px 10px;
                    border-radius: 5px;
                    border: 1px solid var(--border-color, #666);
                    background: var(--comfy-input-bg, rgba(0,0,0,0.20));
                    color: var(--input-text, inherit);
                    cursor: pointer;
                }
                .lera-tt-copy-btn:hover {
                    filter: brightness(1.08);
                }
                .lera-tt-delete-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 30px;
                }
                .lera-tt-delete-btn {
                    width: 26px;
                    height: 26px;
                    border-radius: 4px;
                    border: 1px solid var(--border-color, #666);
                    background: var(--comfy-input-bg, rgba(0,0,0,0.20));
                    color: var(--input-text, inherit);
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                    font-size: 14px;
                }
                .lera-tt-delete-btn:hover {
                    filter: brightness(1.08);
                }
            `;
            root.appendChild(styleBlock);

            const header = document.createElement("div");
            header.className = "lera-tt-header-row";

            const hDrag = document.createElement("div");
            hDrag.textContent = "≡";

            const hOn = document.createElement("div");
            hOn.textContent = "On";

            const hTag = document.createElement("div");
            hTag.textContent = "Tag";

            const hComment = document.createElement("div");
            hComment.textContent = "Comment";

            const hDelete = document.createElement("div");
            hDelete.textContent = "×";
            hDelete.style.textAlign = "center";

            header.appendChild(hDrag);
            header.appendChild(hOn);
            header.appendChild(hTag);
            header.appendChild(hComment);
            header.appendChild(hDelete);
            root.appendChild(header);

            const rowsWrap = document.createElement("div");
            rowsWrap.style.display = "flex";
            rowsWrap.style.flexDirection = "column";
            rowsWrap.style.gap = "6px";
            rowsWrap.style.width = "100%";
            rowsWrap.style.boxSizing = "border-box";
            root.appendChild(rowsWrap);

            const previewTop = document.createElement("div");
            previewTop.className = "lera-tt-preview-top";

            const finalPromptLabel = document.createElement("div");
            finalPromptLabel.textContent = "Final Prompt";
            finalPromptLabel.style.fontWeight = "bold";

            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.className = "lera-tt-copy-btn";
            copyButton.textContent = "Copy";

            previewTop.appendChild(finalPromptLabel);
            previewTop.appendChild(copyButton);
            root.appendChild(previewTop);

            const finalPromptArea = document.createElement("textarea");
            finalPromptArea.readOnly = true;
            finalPromptArea.placeholder = "Итоговый промпт будет отображаться здесь";
            finalPromptArea.rows = 4;
            finalPromptArea.style.width = "100%";
            finalPromptArea.style.minHeight = "90px";
            finalPromptArea.style.font = "inherit";
            finalPromptArea.style.lineHeight = "1.25";
            finalPromptArea.style.padding = "6px 8px";
            finalPromptArea.style.borderRadius = "4px";
            finalPromptArea.style.border = "1px solid var(--border-color, #666)";
            finalPromptArea.style.background = "var(--comfy-input-bg, rgba(0,0,0,0.20))";
            finalPromptArea.style.color = "var(--input-text, inherit)";
            finalPromptArea.style.boxSizing = "border-box";
            finalPromptArea.style.resize = "none";
            finalPromptArea.style.overflow = "hidden";
            finalPromptArea.style.display = "block";
            finalPromptArea.style.whiteSpace = "pre-wrap";
            finalPromptArea.style.wordBreak = "break-word";
            finalPromptArea.style.overflowWrap = "anywhere";
            root.appendChild(finalPromptArea);

            copyButton.addEventListener("click", async () => {
                const text = buildFinalPrompt();
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                    } else {
                        const temp = document.createElement("textarea");
                        temp.value = text;
                        document.body.appendChild(temp);
                        temp.select();
                        document.execCommand("copy");
                        document.body.removeChild(temp);
                    }

                    const oldText = copyButton.textContent;
                    copyButton.textContent = "Copied";
                    setTimeout(() => {
                        copyButton.textContent = oldText;
                    }, 900);
                } catch {
                    const oldText = copyButton.textContent;
                    copyButton.textContent = "Failed";
                    setTimeout(() => {
                        copyButton.textContent = oldText;
                    }, 900);
                }
            });

            const clearDragOverState = () => {
                for (const ref of rowRefs) {
                    ref.row.classList.remove("is-dragover");
                }
            };

            const deleteRowAt = (index) => {
                if (index < 0 || index >= state.length) return;

                if (state.length <= 1) {
                    state[0] = {
                        enabled: true,
                        tag: "",
                        comment: ""
                    };
                    rowsWidget.value = 1;
                } else {
                    state.splice(index, 1);
                    rowsWidget.value = state.length;
                }

                this.properties.tag_table_rows = Number(rowsWidget.value || 1);
                renderRows();
                queueSave();
            };

            const moveRow = (fromIndex, toIndex) => {
                if (
                    fromIndex == null ||
                    toIndex == null ||
                    fromIndex === toIndex ||
                    fromIndex < 0 ||
                    toIndex < 0 ||
                    fromIndex >= state.length ||
                    toIndex >= state.length
                ) {
                    return;
                }

                const [moved] = state.splice(fromIndex, 1);
                state.splice(toIndex, 0, moved);

                renderRows();
                queueSave();
            };

            const renderRows = () => {
                const count = Number(rowsWidget.value || 1);
                ensureRowCount(count);

                rowsWrap.innerHTML = "";
                rowRefs = [];
                dragIndex = null;

                for (let i = 0; i < count; i++) {
                    const row = document.createElement("div");
                    row.className = "lera-tt-row";
                    row.draggable = true;

                    const dragHandle = document.createElement("div");
                    dragHandle.className = "lera-tt-drag";
                    dragHandle.textContent = "⋮⋮";
                    dragHandle.title = "Drag row";

                    const enabledWrap = document.createElement("div");
                    enabledWrap.className = "lera-tt-toggle";

                    const enabledInput = document.createElement("input");
                    enabledInput.type = "checkbox";
                    enabledInput.checked = state[i]?.enabled !== false;
                    enabledWrap.appendChild(enabledInput);

                    const tagInput = document.createElement("textarea");
                    tagInput.className = "lera-tt-input";
                    tagInput.value = state[i]?.tag || "";
                    tagInput.placeholder = "tag";
                    tagInput.rows = 1;
                    tagInput.wrap = "soft";

                    const commentInput = document.createElement("textarea");
                    commentInput.className = "lera-tt-note";
                    commentInput.value = state[i]?.comment || "";
                    commentInput.placeholder = "comment";
                    commentInput.rows = 1;
                    commentInput.wrap = "soft";

                    const deleteWrap = document.createElement("div");
                    deleteWrap.className = "lera-tt-delete-wrap";

                    const deleteButton = document.createElement("button");
                    deleteButton.type = "button";
                    deleteButton.className = "lera-tt-delete-btn";
                    deleteButton.title = "Delete row";
                    deleteButton.textContent = "×";
                    deleteWrap.appendChild(deleteButton);

                    const applyEnabledVisual = () => {
                        const enabled = enabledInput.checked;
                        row.classList.toggle("is-disabled", !enabled);
                    };

                    enabledInput.addEventListener("change", () => {
                        state[i].enabled = enabledInput.checked;
                        applyEnabledVisual();
                        queueLayout();
                        queueSave();
                    });

                    tagInput.addEventListener("input", () => {
                        state[i].tag = tagInput.value;
                        syncSingleRowHeight(tagInput, commentInput);
                        queueLayout();
                        queueSave();
                    });

                    commentInput.addEventListener("input", () => {
                        state[i].comment = commentInput.value;
                        syncSingleRowHeight(tagInput, commentInput);
                        queueLayout();
                        queueSave();
                    });

                    deleteButton.addEventListener("click", () => {
                        deleteRowAt(i);
                    });

                    row.addEventListener("dragstart", (e) => {
                        dragIndex = i;
                        row.style.opacity = "0.55";

                        if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", String(i));
                        }
                    });

                    row.addEventListener("dragend", () => {
                        row.style.opacity = "";
                        dragIndex = null;
                        clearDragOverState();
                    });

                    row.addEventListener("dragover", (e) => {
                        e.preventDefault();
                        clearDragOverState();
                        row.classList.add("is-dragover");
                    });

                    row.addEventListener("dragleave", () => {
                        row.classList.remove("is-dragover");
                    });

                    row.addEventListener("drop", (e) => {
                        e.preventDefault();
                        row.classList.remove("is-dragover");
                        moveRow(dragIndex, i);
                    });

                    applyEnabledVisual();

                    row.appendChild(dragHandle);
                    row.appendChild(enabledWrap);
                    row.appendChild(tagInput);
                    row.appendChild(commentInput);
                    row.appendChild(deleteWrap);
                    rowsWrap.appendChild(row);

                    rowRefs.push({
                        row,
                        enabledInput,
                        tagInput,
                        commentInput,
                        deleteButton,
                    });
                }

                finalPromptArea.value = buildFinalPrompt();

                for (const ref of rowRefs) {
                    syncSingleRowHeight(ref.tagInput, ref.commentInput);
                }
                autoResizeTextarea(finalPromptArea);

                queueLayout();
            };

            const oldRowsCallback = rowsWidget.callback;
            rowsWidget.callback = (value, ...args) => {
                if (oldRowsCallback) {
                    oldRowsCallback.call(rowsWidget, value, ...args);
                }

                const count = Math.max(1, Number(value || 1));
                ensureRowCount(count);
                renderRows();
                queueSave();
            };

            const domWidget = this.addDOMWidget("tag_table_dom", "tag_table_dom", root, {
                serialize: false,
                hideOnZoom: false,
            });

            if (domWidget) {
                domWidget.computeSize = (width) => {
                    return [
                        Math.max(width || MIN_WIDTH, MIN_WIDTH),
                        Math.max(root.scrollHeight + 16, 260),
                    ];
                };
            }

            const oldOnResize = this.onResize?.bind(this);
            this.onResize = (...args) => {
                if (oldOnResize) {
                    oldOnResize(...args);
                }

                this.properties = this.properties || {};

                const actualWidth = Array.isArray(this.size) ? this.size[0] : null;
                const actualHeight = Array.isArray(this.size) ? this.size[1] : null;

                if (actualWidth) {
                    preferredWidth = snapSize(actualWidth, MIN_WIDTH);
                    this.size[0] = preferredWidth;
                    this.properties.tag_table_width = preferredWidth;
                }

                if (actualHeight) {
                    preferredHeight = snapSize(actualHeight, MIN_HEIGHT);
                    this.size[1] = preferredHeight;
                    this.properties.tag_table_height = preferredHeight;
                }

                this.setDirtyCanvas(true, true);
                app.graph.setDirtyCanvas(true, true);
                queueSave();
            };

            this.__tagTableRefresh = () => {
                state = loadState();

                if (this.properties?.tag_table_rows != null) {
                    rowsWidget.value = Number(this.properties.tag_table_rows);
                }

                preferredWidth = snapSize(
                    Number(this.properties?.tag_table_width) || preferredWidth,
                    MIN_WIDTH
                );
                preferredHeight = snapSize(
                    Number(this.properties?.tag_table_height) || preferredHeight,
                    MIN_HEIGHT
                );

                applyNodeSize();
                renderRows();
            };

            applyNodeSize();
            renderRows();
            queueSave();
        }
    }
});