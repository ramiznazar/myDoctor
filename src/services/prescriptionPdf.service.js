const PDFDocument = require('pdfkit');

const safeText = (value) => {
  if (value === null || value === undefined) return '';
  return value.toString();
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAddress = (address) => {
  if (!address) return '';
  const parts = [address.line1, address.line2, address.city, address.state, address.zip, address.country].filter(Boolean);
  return parts.join(', ');
};

const streamPrescriptionPdf = ({ res, prescription }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prescription-${prescription._id.toString()}.pdf"`);

  doc.pipe(res);

  const doctor = prescription.doctorId || {};
  const patient = prescription.patientId || {};
  const appointment = prescription.appointmentId || {};

  doc.fontSize(18).text('Prescription', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor('#333');
  doc.text(`Issued: ${formatDate(prescription.issuedAt || prescription.createdAt)}`, { align: 'right' });
  doc.text(`Prescription ID: ${prescription._id.toString()}`, { align: 'right' });
  if (appointment.appointmentNumber) {
    doc.text(`Appointment: ${safeText(appointment.appointmentNumber)}`, { align: 'right' });
  }

  doc.moveDown();

  doc.fontSize(12).fillColor('#000').text('Prescriber (Doctor)', { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10).text(`Name: ${safeText(doctor.fullName)}`);
  doc.text(`Email: ${safeText(doctor.email)}`);
  doc.text(`Phone: ${safeText(doctor.phone)}`);

  doc.moveDown();

  doc.fontSize(12).fillColor('#000').text('Patient', { underline: true });
  doc.moveDown(0.25);
  doc.fontSize(10).text(`Name: ${safeText(patient.fullName)}`);
  doc.text(`Email: ${safeText(patient.email)}`);
  doc.text(`Phone: ${safeText(patient.phone)}`);
  doc.text(`Gender: ${safeText(patient.gender)}`);
  doc.text(`Date of Birth: ${formatDate(patient.dob)}`);
  doc.text(`Address: ${formatAddress(patient.address)}`);

  doc.moveDown();

  doc.fontSize(12).fillColor('#000').text('Clinical Information', { underline: true });
  doc.moveDown(0.25);
  if (prescription.diagnosis) doc.fontSize(10).text(`Diagnosis: ${safeText(prescription.diagnosis)}`);
  if (prescription.allergies) doc.fontSize(10).text(`Allergies: ${safeText(prescription.allergies)}`);
  if (prescription.clinicalNotes) {
    doc.moveDown(0.25);
    doc.fontSize(10).text('Clinical Notes:', { continued: false });
    doc.fontSize(10).text(safeText(prescription.clinicalNotes));
  }

  doc.moveDown();

  doc.fontSize(12).fillColor('#000').text('Medications', { underline: true });
  doc.moveDown(0.25);

  const meds = Array.isArray(prescription.medications) ? prescription.medications : [];
  if (meds.length === 0) {
    doc.fontSize(10).fillColor('#555').text('No medications listed.');
  } else {
    meds.forEach((m, idx) => {
      doc.fontSize(10).fillColor('#000').text(`${idx + 1}. ${safeText(m.name)} ${safeText(m.strength)} ${safeText(m.form)}`.trim());
      const lines = [
        m.route ? `Route: ${safeText(m.route)}` : null,
        m.dosage ? `Dosage: ${safeText(m.dosage)}` : null,
        m.frequency ? `Frequency: ${safeText(m.frequency)}` : null,
        m.duration ? `Duration: ${safeText(m.duration)}` : null,
        m.quantity ? `Quantity: ${safeText(m.quantity)}` : null,
        typeof m.refills === 'number' ? `Refills: ${m.refills}` : null,
        m.isPrn ? 'PRN: Yes' : null,
        m.substitutionAllowed === false ? 'Substitution Allowed: No' : null
      ].filter(Boolean);
      lines.forEach((l) => doc.fontSize(9).fillColor('#333').text(`   - ${l}`));
      if (m.instructions) {
        doc.fontSize(9).fillColor('#333').text(`   - Instructions: ${safeText(m.instructions)}`);
      }
      doc.moveDown(0.3);
    });
  }

  const tests = Array.isArray(prescription.tests) ? prescription.tests : [];
  if (tests.length > 0) {
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000').text('Recommended Tests', { underline: true });
    doc.moveDown(0.25);
    tests.forEach((t) => doc.fontSize(10).fillColor('#000').text(`- ${safeText(t)}`));
  }

  if (prescription.advice) {
    doc.moveDown();
    doc.fontSize(12).fillColor('#000').text('Advice', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#000').text(safeText(prescription.advice));
  }

  if (prescription.followUp) {
    doc.moveDown();
    doc.fontSize(12).fillColor('#000').text('Follow Up', { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#000').text(safeText(prescription.followUp));
  }

  doc.moveDown();
  doc.fontSize(9).fillColor('#666').text('This prescription is generated electronically and is valid without a signature where permitted by local regulations.', { align: 'center' });

  doc.end();
};

module.exports = {
  streamPrescriptionPdf
};
