#!/usr/bin/env node

/**
 * Build script for Codeforces Timer Extension
 * Organizes files for production deployment
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';

// Files to copy to build directory
const COPY_FILES = [
  'manifest.json',
  'styles.css',
  'stats.html',
  'stats.js',
  'icons/',
  'README.md',
  'LICENSE',
  'CHANGELOG.md'
];

// Create build directory
function createBuildDir() {
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
  }
  fs.mkdirSync(BUILD_DIR);
  console.log('✅ Created build directory');
}

// Copy files to build directory
function copyFiles() {
  COPY_FILES.forEach(file => {
    const srcPath = file;
    const destPath = path.join(BUILD_DIR, file);
    
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      console.log(`✅ Copied ${file}`);
    } else {
      console.warn(`⚠️  File not found: ${file}`);
    }
  });
}

// Copy source files maintaining structure
function copySourceFiles() {
  function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ Copied ${path.relative('.', srcPath)}`);
      }
    });
  }
  
  copyDir(SRC_DIR, path.join(BUILD_DIR, SRC_DIR));
}

// Update manifest for production
function updateManifest() {
  const manifestPath = path.join(BUILD_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Add production-specific configurations
  manifest.version = process.env.EXTENSION_VERSION || manifest.version;
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Updated manifest for production');
}

// Main build function
function build() {
  console.log('🚀 Starting build process...');
  
  try {
    createBuildDir();
    copyFiles();
    copySourceFiles();
    updateManifest();
    
    console.log('✅ Build completed successfully!');
    console.log(`📦 Extension ready in ${BUILD_DIR}/ directory`);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build };
