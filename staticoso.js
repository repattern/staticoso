// this takes all provided html files runs through the text, and replaces the variables with the values from the template

var fs = require('fs');

// if the first command line argument is -h or --help, print the help message
if (process.argv[2] == '-h' || process.argv[2] == '--help' || process.argv.length < 3) {
    console.log('Staticoso takes all files in a folder with *_template.htm or *_template.html extensions and replaces the variables in the file with the values from the staticoso.json file');
    console.log('Usage: node staticoso.js <workingfolder> <selector>');
    console.log('The <selector> is optional, and if not provided, it will default to the first entry in the template file');
    console.log('Example: node staticoso.js ./src/ en');
    process.exit(0);
}

// get first command line argument
var folder = process.argv[2];
// the selector is used to select among different versions of a variable
var selector = process.argv[3];

// read the staticoso.json file
var template = JSON.parse(fs.readFileSync(folder + '/staticoso.json', 'utf8'));
var extensions = template["settings"]["extensions"];
// fill the variable extensions with the standard if it is undefined
if (extensions == undefined) {
    extensions = ['htm', 'html'];
}

// read all files with the provided extensions
// if no extensions are provided, it will default to .htm and .html
var files = fs.readdirSync(folder).filter(function(file) {
    // return all files that match the extensions
    return extensions.indexOf(file.split('.').pop()) > -1;
});

// get through all the files
files.forEach(function(file) {
    // read the file
    var sourceFileContent = fs.readFileSync(folder + '/' + file, 'utf8');
    // get the variables that match {{ variable }} and return the content of the matching variable without the brackets
    var sourceVariables = sourceFileContent.match(/\{\{[^}]+\}\}/g);
    // build an associative array with the variables and their values
    var variables = {};
    sourceVariables.forEach(sourceVariable =>{
        variables[sourceVariable] = sourceVariable.replace(/\{\{|\}\}/g, '').trim().toLowerCase();
    });
    // if variables to replace are found, replace them
    if (sourceVariables.length > 0) {
        // get the values for the variables
        sourceVariables.forEach(sourceVariable =>{
            // get the value, either the standard one, or the selected one or the value, if it's not an object
            var templateValue = template[variables[sourceVariable]];
            var actualValue = "";
            if (typeof(templateValue) === 'object') {
                if (selector == undefined){
                    actualValue = Object.values(templateValue)[0];
                } else {
                    actualValue = templateValue[selector];
                }
            } else {
                actualValue = templateValue;
            }
            // replace the variable with the value
            sourceFileContent = sourceFileContent.replace(sourceVariable, actualValue);
        });
    }
    //console.log(html);
    // create the folder public if it doesn't exist
    if (!fs.existsSync(folder + '/public')) {
        fs.mkdirSync(folder + '/public');
    }
    // write out the html to a new file
    fs.writeFileSync(folder + '/public/' + file, sourceFileContent);
    console.log(variables);
});