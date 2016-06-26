/**
 * Parses the UWaterloo unofficial undergraduate transcript
 * A modified version of the parser written for UWFlow found here:
 * https://github.com/UWFlow/rmc/blob/master/server/static/js/transcript.js
 */
function parseTranscript(data) {
  var beginMarker =
      'UNIVERSITY  OF  WATERLOO  UNDERGRADUATE  UNOFFICIAL  TRANSCRIPT';
  var endMarker = 'End of Transcript';

  var beginIndex = data.indexOf(beginMarker);
  if (beginIndex !== -1) {
    beginIndex += beginMarker.length;
  }
  var endIndex = data.indexOf(endMarker);
  if (endIndex === -1) {
    endIndex = data.length;
  }
  // Set portion of transcript that we care about to be between
  // begin and end markers
  data = data.substring(beginIndex, endIndex);

  var matches = data.match(/Student ID: (\d+)/);
  var studentId;
  if (matches) {
    studentId = parseInt(matches[1], 10);
  }

  matches = data.match(/Program: (.*?)[\n]/);
  var programName = matches[1].trim();

  var termsRaw = [];

  var termRe = /Spring|Fall|Winter/g;
  var match = termRe.exec(data);
  var lastIndex = -1;
  // Split the transcript by terms
  while (match) {
    if (lastIndex !== -1) {
      var termRaw = data.substring(lastIndex, match.index);
      termsRaw.push(termRaw);
    }
    lastIndex = match.index;
    match = termRe.exec(data);
  }
  if (lastIndex > -1) {
    termsRaw.push(data.substring(lastIndex));
  }

  var coursesByTerm = [];
  // Parse out the term and courses taken in that term
  termsRaw.forEach(function(termRaw, i) {
    var matches = termRaw.match(
        /^((?:Spring|Fall|Winter) \d{4})\s+(\d[A-B])/);
    if (!matches) {
      // This could happen for a term that is a transfer from another school
      return;
    }

    var termName = matches[1];
    var programYearId = matches[2];
    termRaw = termRaw.substring(termName.length);

    var termLines = termRaw.split(/\r\n|\r|\n/g);
    var courses = [];
    termLines.forEach(function(termLine) {
      // Assumption is that course codes that identify courses you've taken
      // should only appear at the beginning of a line
      matches = termLine.match(
        /^(\s*[A-Z]+ \d{3}[A-Z]?).+(\d+\.\d+\/\d+\.\d+\s[\s\w\d\/\.]+)$/);
      if (!matches || !matches.length) {
        return;
      }
      var course = matches[1];
      var details = matches[2].split(/\s+/);
      var grade = parseInt(details[1]);
      var weight = parseFloat(details[0].split('/')[0]);
      var credit = details[2] == "Y";
      var inGpa = details[3] == "Y";
      var gpa = inGpa ? toGpa(grade) : 'N/A';
     
      courses.push({
        course: course,
        grade: grade,
        weight: weight,
        credit: credit,
        inGpa: inGpa,
        gpa: gpa
      });
    });

    var sumWeightedGpa = 0;
    var sumCredits = 0;
    courses.forEach(function(course) {
      if (course.inGpa) {
        sumWeightedGpa += course.gpa*course.weight;
        sumCredits += course.weight;
      }
    });
    var termGpa = (sumCredits != 0) ? sumWeightedGpa / sumCredits : 0;

    coursesByTerm.push({
      name: termName,
      programYearId: programYearId,
      courses: courses,
      sumWeightedGpa: sumWeightedGpa,
      sumCredits: sumCredits,
      gpa: termGpa
    });
  });

  var totalWeightedGpa = totalSum(coursesByTerm, "sumWeightedGpa");
  var totalCredits = totalSum(coursesByTerm, "sumCredits");
  var cGpa = (totalCredits != 0) ? totalWeightedGpa / totalCredits : 0;

  return {
    coursesByTerm: coursesByTerm,
    studentId: studentId,
    programName: programName,
    cGpa: cGpa
  };
}

/**
 * Converts a percentage into GPA using the following scale:
 * http://studentsuccess.mcmaster.ca/students/tools/gpa-conversion-chart.html
 */
function toGpa(percent) {
  if (percent >= 90) return 4.0;
  else if (percent >= 85) return 3.9;
  else if (percent >= 80) return 3.7;
  else if (percent >= 77) return 3.3;
  else if (percent >= 73) return 3.0;
  else if (percent >= 70) return 2.7;
  else if (percent >= 67) return 2.3;
  else if (percent >= 63) return 2.0;
  else if (percent >= 60) return 1.7;
  else if (percent >= 57) return 1.3;
  else if (percent >= 53) return 1.0;
  else if (percent >= 50) return 0.7;
  else return 0;
}

/**
 * Sums up a given field in coursesByTerm.
 */
function totalSum(coursesByTerm, field) {
  var add = function(a, b) { return a + b};
  var fieldByTerm = coursesByTerm.map(function(x) { return x[field]})
  return fieldByTerm.reduce(add, 0);
}

/**
 * Runs the parser on the data in the element with ID sourceId
 * and populates the element with ID resultId.
 */
function populateGpa(sourceId, resultId) {
  var data = document.getElementById(sourceId).value;
  try{
    var details = parseTranscript(data);
    var display = "<h2>Your cumulative GPA is: " + details.cGpa.toFixed(2) + "</h2>\
                   <table>\
                     <tr>\
                       <td>Student ID: </td>\
                       <td>" + details.studentId + "</td>\
                     </tr>\
                     <tr>\
                       <td>Program: </td>\
                       <td>" + details.programName + "</td>\
                     </tr>\
                   </table>"
    
    details.coursesByTerm.forEach(function(term) {
      if (term.gpa != 0) {
        display += "<hr>\
                    <h3>" + term.programYearId + " - " + term.name + "</h3>\
                    <table class='term-table'>\
                      <tr>\
                        <th>Course</th>\
                        <th>Percent</th>\
                        <th>Weight</th>\
                        <th>GPA</th>\
                        <th>In GPA?</th>\
                      </tr>";
        term.courses.forEach(function(course) {
          display += "<tr>\
                        <td>" + course.course + "</td>\
                        <td>" + (course.grade || "N/A") + "</td>\
                        <td>" + (typeof(course.weight) == "number" ? course.weight.toFixed(2) : course.weight) + "</td>\
                        <td>" + (typeof(course.gpa) == "number" ? course.gpa.toFixed(2) : course.gpa) + "</td>\
                        <td>" + (course.inGpa ? "Y" : "N") + "</td>\
                      </tr>";
        });
        display += "</table>\
                    <span class='term-gpa'>Term GPA: " + term.gpa.toFixed(2) + "</span>";
      }
    });
  } catch(err) {
    var display = "<p style='color:red'>An error has occured while parsing your transcript. Make sure you are selecting your transcript contents when you are copying the page.</p>";
  }
  
  document.getElementById(resultId).innerHTML = display;
}