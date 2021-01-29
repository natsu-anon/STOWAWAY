var blessed = require('blessed'),
    fs = require('fs');
// Screen
var screen = blessed.screen({
  smartCSR: true,
  title: 'Blessed form'
});
// Form
var form = blessed.form({
  parent: screen,
  width: '90%',
  left: 'center',
  keys: true,
  vi: true
});
// Text boxes
var label1 = blessed.text({
  parent: screen,
  top: 3,
  left: 5,
  content: 'FIRST NAME:'
});
var firstName = blessed.textbox({
  parent: form,
  name: 'firstname',
  top: 4,
  left: 5,
  height: 3,
  inputOnFocus: true,
  content: 'first',
  border: {
    type: 'line'
  },
  focus: {
    fg: 'blue'
  }
});
var label2 = blessed.text({
  parent: screen,
  content: 'LAST NAME:',
  top: 8,
  left: 5
});
var lastName = blessed.textbox({
  parent: form,
  name: 'lastname',
  top: 9,
  left: 5,
  height: 3,
  inputOnFocus: true,
  content: 'last',
  border: {
    type: 'line'
  },
  focus: {
    fg: 'blue'
  }
});
// Check boxes
var label3 = blessed.text({
  parent: screen,
  content: 'What are your favorite editors?',
  top: 14,
  left: 5
});
var vim = blessed.checkbox({
  parent: form,
  name: 'editors',
  content: 'Vim',
  top: 16,
  left: 5
});
var emacs = blessed.checkbox({
  parent: form,
  name: 'editors',
  content: 'Emacs',
  top: 16,
  left: 20
});
var atom = blessed.checkbox({
  parent: form,
  name: 'editors',
  content: 'Atom',
  top: 16,
  left: 35
});
var brackets = blessed.checkbox({
  parent: form,
  name: 'editors',
  content: 'Brackets',
  top: 16,
  left: 50
});
// Radio buttons
var label4 = blessed.text({
  parent: screen,
  content: 'Do you like Blessed?',
  top: 19,
  left: 5
});
var radioset = blessed.radioset({
  parent: form,
  width: '100%',
  height: 5,
  top: 21
});
var yes = blessed.radiobutton({
  parent: radioset,
  name: 'like',
  content: 'Yes',
  left: 5
});
var no = blessed.radiobutton({
  parent: radioset,
  name: 'like',
  content: 'No',
  left: 15
});
// Text area
var label5 = blessed.text({
  parent: screen,
  content: 'Your comments...',
  top: 24,
  left: 5
});
var textarea = blessed.textarea({
  parent: form,
  name: 'comments',
  top: 26,
  left: 5,
  height: 7,
  inputOnFocus: true,
  border: {
    type: 'line'
  }
});
// Submit/Cancel buttons
var submit = blessed.button({
  parent: form,
  name: 'submit',
  content: 'Submit',
  top: 35,
  left: 5,
  shrink: true,
  padding: {
    top: 1,
    right: 2,
    bottom: 1,
    left: 2
  },
  style: {
    bold: true,
    fg: 'white',
    bg: 'green',
    focus: {
      inverse: true
    }
  }
});
var reset = blessed.button({
  parent: form,
  name: 'reset',
  content: 'Reset',
  top: 35,
  left: 15,
  shrink: true,
  padding: {
    top: 1,
    right: 2,
    bottom: 1,
    left: 2
  },
  style: {
    bold: true,
    fg: 'white',
    bg: 'red',
    focus: {
      inverse: true
    }
  }
});
// Info
var msg = blessed.message({
  parent: screen,
  top: 40,
  left: 5,
  style: {
    italic: true,
    fg: 'green'
  }
});
var table = blessed.table({
  parent: screen,
  content: '',
  top: 40,
  left: 'center',
  style: {
    fg: 'green',
    header: {
      bold: true,
      fg: 'white',
      bg: 'blue'
    }
  },
  hidden: true
});
// Event management
submit.on('press', function () {
  form.submit();
});
reset.on('press', function () {
  form.reset();
});
form.on('submit', function (data) {
  var editors = ['Vim', 'Emacs', 'Atom', 'Brackets'].filter(function (item, index) {
    return data.editors[index];
  });
  msg.display('Form submitted!', function () {
    var summary = '';
    summary += data.firstname + ' ' + data.lastname + '\n';
    summary += '------------------------------\n';
    summary += 'Favorite editors: ' + editors + '\n';
    summary += 'Likes Blessed: ' + data.like[0] + '\n';
    summary += 'Comments: ' + data.comments;
    fs.writeFile('form-data.txt', summary, function (err) {
      if (err) throw err;
    });
  });
});
form.on('reset', function () {
  msg.display('Form cleared!', function () {});
});
// Key bindings
screen.key('q', function () {
  this.destroy();
});
// Render everything!
screen.render();
