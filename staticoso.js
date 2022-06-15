// this takes all provided html files runs through the text, and replaces the variables with the values from the template

var fs = require('fs');

// if the first command line argument is -h or --help, print the help message
if (process.argv[2] == '-h' || process.argv[2] == '--help' || process.argv.length < 3) {
    console.log('Staticoso takes all files in a folder replaces the variables in the file with the values from the staticoso.json file');
    console.log('Usage: node staticoso.js <workingfolder> <selector>');
    console.log('The <selector> is optional, and if not provided, it will default to the first entry in the template file');
    console.log('Example: node staticoso.js ./src/ en');
    console.log('The staticoso.json file can describe other extensions that the standard HTML extension');
    process.exit(0);
}

// get first command line argument
var folder = process.argv[2];
// the selector is used to select among different versions of a variable
var selector = process.argv[3];

// read the staticoso.json file
var template = JSON.parse(fs.readFileSync(folder + '/staticoso.json', 'utf8'));
var templateVariables = {};
var templateIncludes = {};
var extensions = template["extensions"];
var renames = template["renames"];
var ignores = template["ignores"];
Object.keys(template["variables"]).forEach( varKey => { 
    templateVariables[varKey.toLowerCase()] = template["variables"][varKey];
});
Object.keys(template["includes"]).forEach( varKey => { 
    templateIncludes[varKey.toLowerCase()] = template["includes"][varKey];
});

// fill the variable extensions with the standard if it is undefined
if (extensions == undefined) {
    extensions = ['htm', 'html'];
}

// read all files with the provided extensions
// if no extensions are provided, it will default to .htm and .html
var files = fs.readdirSync(folder).filter(function (file) {
    // return all files that match the extensions
    return extensions.indexOf(file.split('.').pop()) > -1;
});

// get through all the files
files.forEach(function (file) {
    // skip the file if it is in the ignores list
    if (ignores.indexOf(file) > -1) {
        return;
    }
    console.log('Processing file: ' + file);
    // read the file
    var sourceFileContent = fs.readFileSync(folder + '/' + file, 'utf8');
    // get the variables that match {{ variable }} with and  without spaces and return the content of the matching variable without the brackets
    var sourceVariables = sourceFileContent.match(/\{\{[^\}]*\}\}/g);
    // build an associative array with the variables and their values
    var variables = {};
    if (sourceVariables == null) {
        console.log('No variables found in file: ' + file);
    }
    // if variables to replace are found, replace them
    if (sourceVariables != null) {
        console.log('Found ' + sourceVariables.length + ' variables in file: ' + file);
        sourceVariables.forEach(sourceVariable => {
            variables[sourceVariable] = sourceVariable.replace(/\{\{|\}\}/g, '').trim().toLowerCase();
        });
        // get the values for the variables
        sourceVariables.forEach(sourceVariable => {
            // get the value, either the standard one, or the selected one or the value, if it's not an object
            var templateValue = templateVariables[variables[sourceVariable]];
            // if the value is not defined, we try to get it from the templateIncludes
            if (templateValue == undefined) {
                // we read the content of the include into the variable templateValue
                // check if the file exists
                if (fs.existsSync(folder + '/' + templateIncludes[variables[sourceVariable]])) {
                    templateValue = fs.readFileSync(folder + '/' + templateIncludes[variables[sourceVariable]], 'utf8');
                }
            }
            var actualValue = "";
            if (typeof (templateValue) === 'object') {
                if (selector == undefined) {
                    actualValue = Object.values(templateValue)[0];
                } else {
                    actualValue = templateValue[selector];
                }
            } else {
                actualValue = templateValue;
            }
            if (actualValue == undefined) {
                // search occurrence in line and get the line number
                var lineNumber = sourceFileContent.substring(0, sourceFileContent.indexOf(sourceVariable)).split('\n').length;
                console.error('Variable "', sourceVariable , '" found in file on line', lineNumber ,  'not found in staticoso template file ('+variables[sourceVariable]+')');
            } else {
                sourceFileContent = sourceFileContent.replace(sourceVariable, actualValue);
            }
        });

        // create the folder public if it doesn't exist
        if (!fs.existsSync(folder + '/public')) {
            fs.mkdirSync(folder + '/public');
        }
        // append the selector to the file name if it is not undefined

        if (selector != undefined) {
            var extension = file.split('.').pop();
            file = file.replace('.' + extension,  '_' + selector + '.' + extension);
        }
        // write out the html to a new file
        console.log('Writing file: ' + folder + '/public/' + file);
        // check if this file has to be renamed
        if (renames != undefined) {
            if (renames[file] != undefined) {
                file = renames[file];
                console.log('Renaming file to: ' + file);
            }
        }
        fs.writeFileSync(folder + '/public/' + file, sourceFileContent);
    }
    console.log('');
});