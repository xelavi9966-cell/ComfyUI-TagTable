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

        nodeType.prototype.onConfigure = function (info) {
            const result = originalOnConfigure
                ? originalOnConfigure.apply(this, arguments)
                : undefined;

            if (this.__tagTableRefresh) {
                setTimeout(() => this.__tagTableRefresh(), 0);
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
                if (this.__tagTableRefresh) {
                    this.__tagTableRefresh();
                }
                return;
            }
            this.__tagTableInitialized = true;

            tableDataWidget.hidden = true;
            this.properties = this.properties || {};

            const safeParseArray = (value) => {
                try {
                    const parsed = JSON.parse(value || "[]");
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
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

            const buildFinalPrompt = () => {
                return state
                    .filter(row => row.enabled && String(row.tag || "").trim())
                    .map(row => String(row.tag || "").trim())
                    .join(" ");
            };

            const saveState = () => {
                const json = JSON.stringify(state);

                tableDataWidget.value = json;
                this.properties.tag_table_data = json;
                this.properties.tag_table_rows = Number(rowsWidget.value || 1);

                if (tableDataWidget.callback) {
                    tableDataWidget.callback(tableDataWidget.value);
                }

                if (finalPromptArea) {
                    finalPromptArea.value = buildFinalPrompt();
                    autoResizeTextarea(finalPromptArea);
                }

                this.setDirtyCanvas(true, true);
                app.graph.setDirtyCanvas(true, true);
            };

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

            const autoResizeTextarea = (textarea) => {
                if (!textarea) return;
                textarea.style.height = "auto";
                textarea.style.height = Math.max(textarea.scrollHeight, 30) + "px";
            };

            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "6px";
            container.style.padding = "6px";
            container.style.minWidth = "520px";
            container.style.width = "100%";
            container.style.boxSizing = "border-box";
            container.style.overflow = "hidden";

            const header = document.createElement("div");
            header.style.display = "grid";
            header.style.gridTemplateColumns = "70px 1fr 1fr";
            header.style.gap = "6px";
            header.style.fontWeight = "bold";
            header.style.width = "100%";
            header.style.boxSizing = "border-box";

            const h0 = document.createElement("div");
            h0.textContent = "On";

            const h1 = document.createElement("div");
            h1.textContent = "Tag";

            const h2 = document.createElement("div");
            h2.textContent = "Comment";

            header.appendChild(h0);
            header.appendChild(h1);
            header.appendChild(h2);
            container.appendChild(header);

            const rowsWrap = document.createElement("div");
            rowsWrap.style.display = "flex";
            rowsWrap.style.flexDirection = "column";
            rowsWrap.style.gap = "6px";
            rowsWrap.style.width = "100%";
            rowsWrap.style.boxSizing = "border-box";
            container.appendChild(rowsWrap);

            const finalPromptLabel = document.createElement("div");
            finalPromptLabel.textContent = "Final Prompt";
            finalPromptLabel.style.fontWeight = "bold";
            finalPromptLabel.style.marginTop = "8px";
            container.appendChild(finalPromptLabel);

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
            finalPromptArea.style.boxSizing = "border-box";
            finalPromptArea.style.resize = "none";
            finalPromptArea.style.overflow = "hidden";
            finalPromptArea.style.display = "block";
            container.appendChild(finalPromptArea);

            const updateNodeSize = () => {
                requestAnimationFrame(() => {
                    autoResizeTextarea(finalPromptArea);

                    const contentHeight = Math.ceil(container.scrollHeight) + 16;
                    const minWidth = 620;
                    const targetWidth = Math.max(minWidth, this.size?.[0] || 0);
                    const targetHeight = Math.max(320, contentHeight + 70);

                    this.setSize([targetWidth, targetHeight]);
                    this.setDirtyCanvas(true, true);
                    app.graph.setDirtyCanvas(true, true);
                });
            };

            const syncSingleRowHeight = (tagInput, commentInput) => {
                autoResizeTextarea(tagInput);
                autoResizeTextarea(commentInput);

                const rowHeight = Math.max(
                    tagInput ? tagInput.scrollHeight : 30,
                    commentInput ? commentInput.scrollHeight : 30,
                    30
                );

                if (tagInput) tagInput.style.height = rowHeight + "px";
                if (commentInput) commentInput.style.height = rowHeight + "px";
            };

            const refreshAllRowHeights = () => {
                for (const ref of rowRefs) {
                    syncSingleRowHeight(ref.tagInput, ref.commentInput);
                }

                if (finalPromptArea) {
                    finalPromptArea.value = buildFinalPrompt();
                    autoResizeTextarea(finalPromptArea);
                }

                updateNodeSize();
            };

            const delayedRefreshHeights = () => {
                refreshAllRowHeights();

                requestAnimationFrame(() => {
                    refreshAllRowHeights();

                    setTimeout(() => {
                        refreshAllRowHeights();

                        setTimeout(() => {
                            refreshAllRowHeights();
                        }, 50);
                    }, 0);
                });
            };

            const renderRows = () => {
                state = loadState();

                const count = Number(rowsWidget.value || 1);
                ensureRowCount(count);

                rowsWrap.innerHTML = "";
                rowRefs = [];

                for (let i = 0; i < count; i++) {
                    const row = document.createElement("div");
                    row.style.display = "grid";
                    row.style.gridTemplateColumns = "70px 1fr 1fr";
                    row.style.gap = "6px";
                    row.style.alignItems = "start";
                    row.style.width = "100%";
                    row.style.boxSizing = "border-box";

                    const enabledWrap = document.createElement("div");
                    enabledWrap.style.display = "flex";
                    enabledWrap.style.alignItems = "center";
                    enabledWrap.style.justifyContent = "center";
                    enabledWrap.style.minHeight = "30px";

                    const enabledInput = document.createElement("input");
                    enabledInput.type = "checkbox";
                    enabledInput.checked = state[i]?.enabled !== false;
                    enabledInput.style.transform = "scale(1.1)";
                    enabledWrap.appendChild(enabledInput);

                    const tagInput = document.createElement("textarea");
                    tagInput.value = state[i]?.tag || "";
                    tagInput.placeholder = "tag";
                    tagInput.rows = 1;
                    tagInput.wrap = "soft";
                    tagInput.style.width = "100%";
                    tagInput.style.minHeight = "30px";
                    tagInput.style.font = "inherit";
                    tagInput.style.lineHeight = "1.25";
                    tagInput.style.padding = "4px 6px";
                    tagInput.style.borderRadius = "4px";
                    tagInput.style.boxSizing = "border-box";
                    tagInput.style.resize = "none";
                    tagInput.style.overflow = "hidden";
                    tagInput.style.display = "block";

                    const commentInput = document.createElement("textarea");
                    commentInput.value = state[i]?.comment || "";
                    commentInput.placeholder = "comment";
                    commentInput.rows = 1;
                    commentInput.wrap = "soft";
                    commentInput.style.width = "100%";
                    commentInput.style.minHeight = "30px";
                    commentInput.style.font = "inherit";
                    commentInput.style.lineHeight = "1.25";
                    commentInput.style.padding = "4px 6px";
                    commentInput.style.borderRadius = "4px";
                    commentInput.style.boxSizing = "border-box";
                    commentInput.style.resize = "none";
                    commentInput.style.overflow = "hidden";
                    commentInput.style.display = "block";

                    const applyEnabledVisual = () => {
                        const enabled = enabledInput.checked;
                        tagInput.style.opacity = enabled ? "1" : "0.45";
                        commentInput.style.opacity = enabled ? "1" : "0.45";
                    };

                    const syncRowHeight = () => {
                        syncSingleRowHeight(tagInput, commentInput);
                        updateNodeSize();
                    };

                    enabledInput.addEventListener("change", () => {
                        state[i].enabled = enabledInput.checked;
                        applyEnabledVisual();
                        saveState();
                        syncRowHeight();
                    });

                    tagInput.addEventListener("input", () => {
                        state[i].tag = tagInput.value;
                        saveState();
                        syncRowHeight();
                    });

                    commentInput.addEventListener("input", () => {
                        state[i].comment = commentInput.value;
                        saveState();
                        syncRowHeight();
                    });

                    applyEnabledVisual();

                    row.appendChild(enabledWrap);
                    row.appendChild(tagInput);
                    row.appendChild(commentInput);
                    rowsWrap.appendChild(row);

                    rowRefs.push({
                        row,
                        enabledInput,
                        tagInput,
                        commentInput
                    });
                }

                if (finalPromptArea) {
                    finalPromptArea.value = buildFinalPrompt();
                    autoResizeTextarea(finalPromptArea);
                }

                saveState();
                delayedRefreshHeights();
            };

            const oldRowsCallback = rowsWidget.callback;
            rowsWidget.callback = (value, ...args) => {
                if (oldRowsCallback) {
                    oldRowsCallback.call(rowsWidget, value, ...args);
                }

                const count = Number(value || 1);
                ensureRowCount(count);
                saveState();
                renderRows();
            };

            const domWidget = this.addDOMWidget(
                "tag_table_dom",
                "tag_table_dom",
                container,
                {
                    serialize: false,
                    hideOnZoom: false,
                }
            );

            if (domWidget) {
                domWidget.computeSize = (width) => {
                    return [
                        Math.max(width || 620, 620),
                        Math.max(container.scrollHeight + 16, 260)
                    ];
                };
            }

            this.__tagTableRefresh = () => {
                if (this.properties?.tag_table_rows != null) {
                    rowsWidget.value = Number(this.properties.tag_table_rows);
                }
                renderRows();
            };

            renderRows();
        }
    }
});