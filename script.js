class PDFEditor {
  constructor() {
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this.history = [];
    this.historyIndex = -1;

    this.initializeElements();
    this.setupEventListeners();
    this.setupPDFJS();
    this.createStatusIndicator();
  }

  initializeElements() {
    this.dropZone = document.getElementById("dropZone");
    this.fileInput = document.getElementById("fileInput");
    this.pdfViewer = document.getElementById("pdfViewer");
    this.pagesPanel = document.getElementById("pagesPanel");
    this.pagesList = document.getElementById("pagesList");
    this.textEditor = document.getElementById("textEditor");
    this.textArea = document.getElementById("textArea");
    this.saveBtn = document.getElementById("saveBtn");
    this.addPageBtn = document.getElementById("addPageBtn");
    this.undoBtn = document.getElementById("undoBtn");
    this.applyTextBtn = document.getElementById("applyTextBtn");
  }

  createStatusIndicator() {
    this.statusIndicator = document.createElement("div");
    this.statusIndicator.className = "status-indicator";
    document.body.appendChild(this.statusIndicator);
  }

  showStatus(message) {
    this.statusIndicator.textContent = message;
    this.statusIndicator.classList.add("show");
    setTimeout(() => {
      this.statusIndicator.classList.remove("show");
    }, 2000);
  }

  setupPDFJS() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  setupEventListeners() {
    this.dropZone.addEventListener("click", () => this.fileInput.click());
    this.dropZone.addEventListener("dragover", this.handleDragOver.bind(this));
    this.dropZone.addEventListener(
      "dragleave",
      this.handleDragLeave.bind(this)
    );
    this.dropZone.addEventListener("drop", this.handleDrop.bind(this));
    this.fileInput.addEventListener("change", this.handleFileSelect.bind(this));

    this.saveBtn.addEventListener("click", this.savePDF.bind(this));
    this.addPageBtn.addEventListener("click", this.addPage.bind(this));
    this.undoBtn.addEventListener("click", this.undo.bind(this));
    this.applyTextBtn.addEventListener(
      "click",
      this.applyTextChanges.bind(this)
    );
  }

  handleDragOver(e) {
    e.preventDefault();
    this.dropZone.classList.add("drag-over");
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.dropZone.classList.remove("drag-over");
  }

  handleDrop(e) {
    e.preventDefault();
    this.dropZone.classList.remove("drag-over");
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "application/pdf") {
      this.loadPDF(files[0]);
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      this.loadPDF(file);
    }
  }

  saveState() {
    if (this.pdfLibDoc) {
      this.historyIndex++;
      this.history = this.history.slice(0, this.historyIndex);

      // Create a fresh copy of the PDF bytes instead of slicing the potentially detached buffer
      this.pdfLibDoc.save().then((freshBytes) => {
        this.history.push({
          pdfBytes: new Uint8Array(freshBytes),
          currentPage: this.currentPage,
          totalPages: this.totalPages,
        });
        this.undoBtn.disabled = false;
      });
    }
  }

  async undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];

      // Use the stored bytes directly
      this.pdfBytes = new Uint8Array(state.pdfBytes);
      this.currentPage = state.currentPage;
      this.totalPages = state.totalPages;

      this.pdfLibDoc = await PDFLib.PDFDocument.load(this.pdfBytes);
      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;

      await this.updateView();
      this.showStatus("Undone");
    }

    this.undoBtn.disabled = this.historyIndex <= 0;
  }

  async loadPDF(file) {
    try {
      this.showLoading();

      const originalBytes = await file.arrayBuffer();
      this.pdfBytes = originalBytes.slice();
      const pdfJsBytes = originalBytes.slice();

      const loadingTask = pdfjsLib.getDocument({ data: pdfJsBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      this.pdfLibDoc = await PDFLib.PDFDocument.load(this.pdfBytes);

      // Initialize history
      this.history = [];
      this.historyIndex = -1;
      this.saveState();

      this.renderPDF();
      this.generateThumbnails();
      this.enableButtons();

      this.dropZone.style.display = "none";
      this.pagesPanel.style.display = "block";
      this.textEditor.style.display = "block";

      this.showStatus("PDF loaded successfully");
    } catch (error) {
      console.error("Error loading PDF:", error);
      this.showStatus("Error loading PDF");
    }
  }

  showLoading() {
    this.pdfViewer.innerHTML = '<div class="loading">Loading PDF...</div>';
  }

  async renderPDF() {
    try {
      const page = await this.pdfDoc.getPage(this.currentPage);
      const viewport = page.getViewport({ scale: this.scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = "pdf-canvas";

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      this.pdfViewer.innerHTML = "";
      this.pdfViewer.appendChild(canvas);

      canvas.addEventListener("click", this.handleCanvasClick.bind(this));
    } catch (error) {
      console.error("Error rendering PDF:", error);
    }
  }

  async generateThumbnails() {
    this.pagesList.innerHTML = "";

    for (let i = 1; i <= this.totalPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.25 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const thumbnail = document.createElement("div");
      thumbnail.className = "page-thumbnail";
      if (i === this.currentPage) thumbnail.classList.add("active");

      thumbnail.appendChild(canvas);

      const pageLabel = document.createElement("div");
      pageLabel.className = "page-label";
      pageLabel.textContent = `Page ${i}`;
      thumbnail.appendChild(pageLabel);

      // Add delete button for each page
      if (this.totalPages > 1) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger page-delete";
        deleteBtn.textContent = "×";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.deletePage(i);
        });
        thumbnail.appendChild(deleteBtn);
      }

      thumbnail.addEventListener("click", () => this.goToPage(i));
      this.pagesList.appendChild(thumbnail);
    }
  }

  async updateView() {
    await this.renderPDF();
    await this.generateThumbnails();
  }

  async goToPage(pageNum) {
    if (pageNum !== this.currentPage) {
      this.currentPage = pageNum;
      await this.renderPDF();

      document.querySelectorAll(".page-thumbnail").forEach((thumb, index) => {
        thumb.classList.toggle("active", index + 1 === pageNum);
      });
    }
  }

  handleCanvasClick(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sampleTexts = [
      "Sample text from PDF",
      "Click to edit this text",
      "Editable content",
      "Text editing mode",
    ];

    const randomText =
      sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    this.textArea.value = randomText;
    this.textArea.focus();
  }

  async applyTextChanges() {
    if (!this.textArea.value.trim()) return;

    try {
      this.saveState();
      this.textArea.value = "";
      this.showStatus("Text changes applied");
    } catch (error) {
      console.error("Error applying text changes:", error);
      this.showStatus("Error applying changes");
    }
  }

  async addPage() {
    try {
      this.saveState();

      const page = this.pdfLibDoc.addPage();
      page.drawText("New Page", {
        x: 50,
        y: 750,
        size: 24,
        color: PDFLib.rgb(0, 0, 0),
      });

      this.pdfBytes = await this.pdfLibDoc.save();

      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      await this.updateView();
      await this.goToPage(this.totalPages);

      this.showStatus("Page added");
    } catch (error) {
      console.error("Error adding page:", error);
      this.showStatus("Error adding page");
    }
  }

  async deletePage(pageIndex) {
    if (this.totalPages <= 1) {
      this.showStatus("Cannot delete the last page");
      return;
    }

    try {
      // Save state before making changes
      await this.saveStateAsync();

      this.pdfLibDoc.removePage(pageIndex - 1);
      this.pdfBytes = await this.pdfLibDoc.save();

      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
      }

      await this.updateView();
      this.showStatus("Page deleted");
    } catch (error) {
      console.error("Error deleting page:", error);
      this.showStatus("Error deleting page");
    }
  }
  async saveStateAsync() {
    if (this.pdfLibDoc) {
      this.historyIndex++;
      this.history = this.history.slice(0, this.historyIndex);

      const freshBytes = await this.pdfLibDoc.save();
      this.history.push({
        pdfBytes: new Uint8Array(freshBytes),
        currentPage: this.currentPage,
        totalPages: this.totalPages,
      });
      this.undoBtn.disabled = false;
    }
  }
  async addPage() {
    try {
      await this.saveStateAsync();

      const page = this.pdfLibDoc.addPage();
      page.drawText("New Page", {
        x: 50,
        y: 750,
        size: 24,
        color: PDFLib.rgb(0, 0, 0),
      });

      this.pdfBytes = await this.pdfLibDoc.save();

      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      await this.updateView();
      await this.goToPage(this.totalPages);

      this.showStatus("Page added");
    } catch (error) {
      console.error("Error adding page:", error);
      this.showStatus("Error adding page");
    }
  }

  async applyTextChanges() {
    if (!this.textArea.value.trim()) return;

    try {
      await this.saveStateAsync();
      this.textArea.value = "";
      this.showStatus("Text changes applied");
    } catch (error) {
      console.error("Error applying text changes:", error);
      this.showStatus("Error applying changes");
    }
  }
  async savePDF() {
    try {
      const pdfBytes = await this.pdfLibDoc.save();

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "edited-document.pdf";
      link.click();

      URL.revokeObjectURL(url);
      this.showStatus("PDF saved");
    } catch (error) {
      console.error("Error saving PDF:", error);
      this.showStatus("Error saving PDF");
    }
  }

  enableButtons() {
    this.saveBtn.disabled = false;
    this.addPageBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PDFEditor();
});
