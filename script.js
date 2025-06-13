class PDFEditor {
  constructor() {
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;

    this.initializeElements();
    this.setupEventListeners();
    this.setupPDFJS();
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
    this.deletePageBtn = document.getElementById("deletePageBtn");
    this.applyTextBtn = document.getElementById("applyTextBtn");
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
    this.deletePageBtn.addEventListener("click", this.deletePage.bind(this));
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

      this.renderPDF();
      this.generateThumbnails();
      this.enableButtons();

      this.dropZone.style.display = "none";
      this.pagesPanel.style.display = "block";
      this.textEditor.style.display = "block";
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert("Error loading PDF. Please try again.");
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
      const viewport = page.getViewport({ scale: 0.3 });

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
      pageLabel.textContent = `Page ${i}`;
      pageLabel.style.marginTop = "5px";
      pageLabel.style.fontSize = "12px";
      pageLabel.style.fontWeight = "600";
      thumbnail.appendChild(pageLabel);

      thumbnail.addEventListener("click", () => this.goToPage(i));
      this.pagesList.appendChild(thumbnail);
    }
  }

  async goToPage(pageNum) {
    this.currentPage = pageNum;
    await this.renderPDF();

    document.querySelectorAll(".page-thumbnail").forEach((thumb, index) => {
      thumb.classList.toggle("active", index + 1 === pageNum);
    });
  }

  handleCanvasClick(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sampleTexts = [
      "Sample text from PDF",
      "Click to edit this text",
      "PDF Editor Pro - Edit Mode",
      "This is editable content",
    ];

    const randomText =
      sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    this.textArea.value = randomText;
    this.textArea.focus();
  }

  async applyTextChanges() {
    if (!this.textArea.value.trim()) return;

    try {
      alert(
        `Text "${this.textArea.value}" would be applied to the PDF.\n\nNote: This is a demo. Full text editing requires more complex PDF manipulation.`
      );

      this.textArea.value = "";
    } catch (error) {
      console.error("Error applying text changes:", error);
      alert("Error applying changes. Please try again.");
    }
  }

  async addPage() {
    try {
      const page = this.pdfLibDoc.addPage();
      page.drawText("New Page Added!", {
        x: 50,
        y: 750,
        size: 24,
        color: PDFLib.rgb(0, 0, 0),
      });

      this.pdfBytes = await this.pdfLibDoc.save();

      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      await this.generateThumbnails();
      await this.goToPage(this.totalPages);

      alert("New page added successfully!");
    } catch (error) {
      console.error("Error adding page:", error);
      alert("Error adding page. Please try again.");
    }
  }

  async deletePage() {
    if (this.totalPages <= 1) {
      alert("Cannot delete the last page!");
      return;
    }

    if (!confirm(`Delete page ${this.currentPage}?`)) return;

    try {
      this.pdfLibDoc.removePage(this.currentPage - 1);

      this.pdfBytes = await this.pdfLibDoc.save();

      const loadingTask = pdfjsLib.getDocument({ data: this.pdfBytes });
      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
      }

      await this.generateThumbnails();
      await this.renderPDF();

      alert("Page deleted successfully!");
    } catch (error) {
      console.error("Error deleting page:", error);
      alert("Error deleting page. Please try again.");
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

      alert("PDF saved successfully!");
    } catch (error) {
      console.error("Error saving PDF:", error);
      alert("Error saving PDF. Please try again.");
    }
  }

  enableButtons() {
    this.saveBtn.disabled = false;
    this.addPageBtn.disabled = false;
    this.deletePageBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PDFEditor();
});
