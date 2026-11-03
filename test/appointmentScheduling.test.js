const test = require('node:test');
const assert = require('node:assert/strict');

const Appointment = require('../src/models/appointment.model');
const Conversation = require('../src/models/conversation.model');
const {
  buildBookableSlots,
  normalizeTimeSlots,
  parseCalendarDate,
} = require('../src/services/weeklySchedule.service');
const {
  calculateEndClock,
  computeAppointmentWindow,
  getAppointmentDateParts,
  isIanaTimeZone,
} = require('../src/utils/appointmentTime');

const mondaySchedule = {
  appointmentDuration: 30,
  days: [
    {
      dayOfWeek: 'Monday',
      timeSlots: [
        { startTime: '09:00', endTime: '11:00', isAvailable: true },
        { startTime: '13:00', endTime: '14:00', isAvailable: false },
      ],
    },
  ],
};

test('weekly availability expands a range into appointment-length slots', () => {
  const slots = buildBookableSlots(mondaySchedule, parseCalendarDate('2026-11-02'));

  assert.deepEqual(slots, [
    { startTime: '09:00', endTime: '09:30', duration: 30 },
    { startTime: '09:30', endTime: '10:00', duration: 30 },
    { startTime: '10:00', endTime: '10:30', duration: 30 },
    { startTime: '10:30', endTime: '11:00', duration: 30 },
  ]);
});

test('separate daily ranges preserve their exact configured start times', () => {
  const slots = buildBookableSlots({
    appointmentDuration: 30,
    days: [{
      dayOfWeek: 'Monday',
      timeSlots: [
        { startTime: '09:45', endTime: '10:45', isAvailable: true },
        { startTime: '17:00', endTime: '18:00', isAvailable: true },
      ],
    }],
  }, parseCalendarDate('2026-11-02'));

  assert.deepEqual(slots, [
    { startTime: '09:45', endTime: '10:15', duration: 30 },
    { startTime: '10:15', endTime: '10:45', duration: 30 },
    { startTime: '17:00', endTime: '17:30', duration: 30 },
    { startTime: '17:30', endTime: '18:00', duration: 30 },
  ]);
});

test('daily availability ranges are sorted and may not overlap', () => {
  assert.deepEqual(
    normalizeTimeSlots([
      { startTime: '17:00', endTime: '21:00', isAvailable: true },
      { startTime: '09:00', endTime: '14:00', isAvailable: true },
    ]).map(({ startTime, endTime, isAvailable }) => ({ startTime, endTime, isAvailable })),
    [
      { startTime: '09:00', endTime: '14:00', isAvailable: true },
      { startTime: '17:00', endTime: '21:00', isAvailable: true },
    ]
  );

  assert.throws(
    () => normalizeTimeSlots([
      { startTime: '09:00', endTime: '12:00', isAvailable: true },
      { startTime: '11:30', endTime: '13:00', isAvailable: true },
    ]),
    /overlaps/
  );
});

test('weekly availability returns no slots for an unavailable weekday', () => {
  assert.deepEqual(
    buildBookableSlots(mondaySchedule, parseCalendarDate('2026-11-03')),
    []
  );
});

test('calendar dates and calculated end clocks are validated deterministically', () => {
  assert.deepEqual(parseCalendarDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
  assert.throws(() => parseCalendarDate('2027-02-29'), /Invalid calendar date/);
  assert.throws(() => getAppointmentDateParts('2026-15-42'), /Invalid appointment date/);
  assert.equal(calculateEndClock('23:45', 30), '00:15');
});

test('an overnight appointment window finishes on the following calendar day', () => {
  const { start, end } = computeAppointmentWindow({
    appointmentDate: '2026-11-02',
    appointmentTime: '23:45',
    appointmentEndTime: '00:15',
    timezone: 'UTC',
  });

  assert.equal(start.toISOString(), '2026-11-02T23:45:00.000Z');
  assert.equal(end.toISOString(), '2026-11-03T00:15:00.000Z');
});

test('appointment windows use the stored device timezone instead of a server or country default', () => {
  assert.equal(isIanaTimeZone('Europe/Rome'), true);
  assert.equal(isIanaTimeZone('UTC'), true);

  const { start } = computeAppointmentWindow({
    appointmentDate: '2026-11-02',
    appointmentTime: '09:45',
    appointmentEndTime: '10:15',
    timezone: 'Europe/Rome',
    // Deliberately supply a conflicting legacy offset. The IANA zone must be
    // authoritative, including its daylight-saving rules.
    timezoneOffset: 300,
  });

  assert.equal(start.toISOString(), '2026-11-02T08:45:00.000Z');
});

test('active slot and canonical relationship indexes ignore released/history records', () => {
  const appointmentIndex = Appointment.schema.indexes().find(([keys]) => keys.activeSlotKey === 1);
  const conversationIndex = Conversation.schema.indexes().find(([keys]) => keys.relationshipKey === 1);

  assert.deepEqual(appointmentIndex[1].partialFilterExpression, { activeSlotKey: { $type: 'string' } });
  assert.deepEqual(conversationIndex[1].partialFilterExpression, { relationshipKey: { $type: 'string' } });
});
