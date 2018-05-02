// Dependencies
    const fs = require('fs');
    const path = require('path');
    const rimraf = require('rimraf');
    const createCSVFile = require('csv-file-creator');

/*
    // Arg Vars
        const copyLocal = process.argv[2];
        console.log("copyLocal:", copyLocal);
        let targetTemplateDirectory = ''
        let targetMDDirectory = ''
        if (copyLocal){
            targetTemplateDirectory = process.argv[3];
            targetMDDirectory = process.argv[4];;
        }
*/

// Required directories
    const dir_in = path.join(__dirname, 'in');
    const dir_out = path.join(__dirname, 'out');

// Init Constants
    const BASE_UPLOAD_URL = "https://s3.amazonaws.com/hifi-content/milad/ROLC/Organize/Projects/Testing/Flow/out/";
    const NUMBER_OF_AVATARS_NEEDED = 160;
    const regEx_fst_name = /(name = )(.*?)\n/;
    const regEx_fst_fileName = /(filename = )(.*)(\/.*)(\..*)\n/
    const regEx_fst_textDir = /(texdir = )([\s\S]*)(\/.*)\n/

// General Variables
    let fbxDirectoryName = "jamica_mon";
    let textureDirectoryName = "textures";   
    let avatarBaseFileName;
    let inputFiles;
    let fstFileRead;
    let currCount = 1;   
    let currFilesRead;
    let currFstFile;
    let currentAvatarBasePath;
    let currentAvatarFbxPath;
    let currentAvatarTexturePath;
    let currentFolderArray;
    let currentAvatarName;
    let csvDataArray = [["Avatar_UN", "Avatar_FST", "Avatar_HFR"]];

// File Input Store;
    let fileInputStore = {
            fst_directory: '',
            fst_file: '',
            fbx_directory: '',
            fbx_file: '',
            texture_directory: '',       
            texture_files: []
    }

// Procedural functions

// Helper functions
    // Copy file from source to target - used for recurssive call
    function copyFileSync( source, target ) {
        let targetFile = target;

        // If target is a directory a new file with the same name will be created
        if ( fs.existsSync( target ) ) {
            // console.log("target exists");
            if ( fs.lstatSync( target ).isDirectory() ) {
                // console.log("target is a directory");
                
                targetFile = path.join( target, path.basename( source ) );
            }
        }

        fs.writeFileSync(targetFile, fs.readFileSync(source));
    }

    // Copy file from source to target
    function copyFolderRecursiveSync( source, target ) {
        var files = [];

        // Check if folder needs to be created or integrated
        var targetFolder = path.join( target, path.basename( source ) );
        if ( !fs.existsSync( targetFolder ) ) {
            fs.mkdirSync( targetFolder );
        }

        // Copy
        if ( fs.lstatSync( source ).isDirectory() ) {
            files = fs.readdirSync( source );
            files.forEach( function ( file ) {
                var curSource = path.join( source, file );
                if ( fs.lstatSync( curSource ).isDirectory() ) {
                    copyFolderRecursiveSync( curSource, targetFolder );
                } else {
                    copyFileSync( curSource, targetFolder );
                }
            });
        }
    }
    
    function baseFSTMaker(){
        let newFstFile = fstFileRead;
        newFstFile = newFstFile.replace(regEx_fst_name, `$1$2_${currCount}\n`)
                               .replace(regEx_fst_fileName, `$1$2_${currCount}$3_${currCount}$4\n`)
                               .replace(regEx_fst_textDir, `$1$2_${currCount}$3\n`);
        return newFstFile;
    }

    function csvEntryMaker(avatarUn){
        let array = [];
        array.push(avatarUn,`${BASE_UPLOAD_URL}${avatarUn}.fst`,`${BASE_UPLOAD_URL}${avatarUn}.hfr`);
        return array;
    }


// Remove out directory if exists to make sure old files aren't kept
    if (fs.existsSync(dir_out)){
        console.log("dir out exists");
        rimraf.sync(dir_out);
    }

// Create out directories for Fbx
    if (!fs.existsSync(dir_out)) {
        fs.mkdirSync(dir_out);
    }

// Read Input Directory
    currFilesRead = fs.readdirSync(dir_in);
    currFilesRead.forEach( file => {
        let curSource = path.join(dir_in, file);
        let curExt = path.extname(curSource);
        let curBaseName = path.basename(curSource, curExt);
        avatarBaseFileName = curBaseName;
        if ( fs.lstatSync( curSource ).isDirectory() ) {
            if (curBaseName === fbxDirectoryName) {
                fileInputStore.fbx_directory = curSource
                fileInputStore.fbx_file = `${curBaseName}.fbx`
                fileInputStore.texture_directory = 
                    path.join(fileInputStore.fbx_directory, textureDirectoryName);
            }
        }
        if (curExt === '.fst') {
            fileInputStore.fst_directory = dir_in;
            fileInputStore.fst_file = file;
            fstFileRead = fs.readFileSync(
                path.join(fileInputStore.fst_directory, fileInputStore.fst_file), {"encoding": 'utf8'});
        }
    })

// Grab The textures
    currFilesRead = fs.readdirSync(fileInputStore.texture_directory);
    currFilesRead.forEach( file => {
        let curSource = path.join(fileInputStore.texture_directory, file);
        let curExt = path.extname(curSource);
        let curBaseName = path.basename(curSource, curExt);
        fileInputStore.texture_files.push(file);
    })

// Run loop to create Avatars
while (currCount <= NUMBER_OF_AVATARS_NEEDED) {
    console.log(`Currently on Avatar ${currCount}`)
    // Create the curr Avatar Folders
    currentAvatarName = `${avatarBaseFileName}_${currCount}`;
    currentAvatarBasePath = 
        path.join(dir_out, currentAvatarName)
    currentAvatarFbxPath = 
        path.join(currentAvatarBasePath, currentAvatarName);
    currentAvatarTexturePath =  
        path.join(currentAvatarFbxPath, 'textures');
    currentFolderArray = [currentAvatarBasePath, currentAvatarFbxPath, currentAvatarTexturePath];
    currentFolderArray.forEach( folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder);
        }
    })

    // Create new fst file
    currFstFile = baseFSTMaker();
    fs.writeFileSync(path.join(currentAvatarBasePath, `${currentAvatarName}.fst`), currFstFile);

    // Copy FBX Over
    copyFileSync(path.join(fileInputStore.fbx_directory, fileInputStore.fbx_file), path.join(currentAvatarFbxPath, currentAvatarName));

    // Copy Textures Over
    fileInputStore.texture_files.forEach( file => {
        copyFileSync(path.join(fileInputStore.texture_directory, file), path.join(currentAvatarTexturePath, `${currentAvatarName}_${file}`));
    });

    // Manipulate the Textures

    // Create CSV file Entry
    csvDataArray.push(csvEntryMaker(currentAvatarName));
    currCount++
    }

createCSVFile(path.join(dir_out, 'data.csv'), csvDataArray);















