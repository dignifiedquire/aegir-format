'use strict'

const exec = require('child_process').execSync
const path = require('path')
const fs = require('fs')
const glob = require('glob')

module.exports = function (user, name) {
  console.log('Starting to transform %s/%s', user, name)

  if (fs.existsSync(`./${name}`)) {
    exec(`rm -rf ./${name}`)
  }

  const cwd = path.resolve(__dirname, 'modules', name)

  // git clone git@github.com:<user>/<repo>.git
  if (!fs.existsSync(cwd)) {
    console.log('Cloning..')
    exec(`git clone git@github.com:${user}/${name}.git`)
  }
  try {
    exec('git checkout dignified', {cwd})
  } catch (err) {
    console.log(err.message)
  }
  // git checkout -b aegir
  const branch = exec('git name-rev --name-only HEAD', {cwd}).toString().trim()
  if (branch === 'master' || branch === 'dignified') {
    console.log('checkout')
    exec('git checkout -b aegir', {cwd})
  }

  // Add .npmignore
  if (!fs.existsSync(path.join(cwd, '.npmignore'))) {
    console.log('Adding .npmignore')
    exec('cp .gitignore .npmignore', {cwd})
    const npmignore = fs.readFileSync(path.join(cwd, '.npmignore')).toString()
    fs.writeFileSync(path.join(cwd, '.npmignore'), npmignore + '\ntest\n')
  }

  // Update .gitignore
  // - append `dist`
  // - append `lib`
  const gitignore = fs.readFileSync(path.join(cwd, '.gitignore')).toString()
  if (!gitignore.match(/\n(lib|dist)\n/)) {
    console.log('Updating .gitignore...')
    fs.writeFileSync(path.join(cwd, '.gitignore'), gitignore + '\nlib\ndist\n')
  }

  // Update package.json
  // - Replace all scripts, except `coverage` with the aegir versions
  // - Remove devDependencies
  //   - karma-*
  //   - json-loader
  //   - babel-loader
  //   - babel*
  //   - eslint*
  //   - standard
  //   - webpack
  // - Set main = 'lib/index.js'
  // - Set jsnext:main = 'src/index.js'

  let pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json')))
  if (!pkg.devDependencies['aegir']) {
    console.log('Updating package.json')
    pkg.main = 'lib/index.js'
    pkg['jsnext:main'] = 'src/index.js'

    pkg.scripts.lint = 'aegir-lint'
    pkg.scripts.test = 'aegir-test'
    pkg.scripts['test:node'] = 'aegir-test node'
    pkg.scripts['test:browser'] = 'aegir-test browser'
    pkg.scripts.build = 'aegir-build'
    pkg.scripts.release = 'aegir-release'
    pkg.scripts.coverage = 'aegir-coverage'
    pkg.scripts['coverage-publish'] = 'aegir-coverage publish'

    pkg['pre-commit'] = ['lint', 'test']

    Object.keys(pkg.devDependencies).forEach((dep) => {
      if (dep.match(/^karma/) ||
          dep.match(/^babel/) ||
          dep.match(/^eslint/) ||
          dep === 'json-loader' ||
          dep === 'istanbul' ||
          dep === 'webpack' ||
          dep === 'dignified.js' ||
          dep === 'standard') {
        delete pkg.devDependencies[dep]
      }
    })

    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg, null, 2))

    // New dependencies
    // - chai
    // - aegir
    // - pre-commit
    console.log('Adding chai and aegir')
    exec('npm install --save-dev aegir', {cwd})
    exec('npm install --save-dev chai', {cwd})
    exec('npm install --save-dev pre-commit', {cwd})
  }

  // Installing dependencies
  console.log('Installing dependencies')
  exec('npm install', {cwd})

  // git rm -rf dist
  if (fs.existsSync(path.join(cwd, 'dist'))) {
    console.log('Removing dist')
    exec('git rm -rf dist', {cwd})
  }

  // Ensure all tests are in `test`
  if (fs.existsSync(path.join(cwd, 'tests'))) {
    console.log('Renaming test folder')
    exec('git mv tests test', {cwd})
  }

  // Add 'use strict' to all js files
  console.log('Adding strict mode')

  const addStrict = (file) => {
    let content = fs.readFileSync(path.join(cwd, file)).toString()

    if (content.match(/'use strict'\n/)) {
      return
    }

    content = `'use strict'\n\n${content}`

    fs.writeFileSync(path.join(cwd, file), content)
  }

  glob.sync('test/**/*.js', {cwd}).forEach(addStrict)
  glob.sync('src/**/*.js', {cwd}).forEach(addStrict)
  glob.sync('examples/**/*.js', {cwd}).forEach(addStrict)

  // Add circle.yml
  console.log('Copying circle.yml')
  exec('cp ../circle.example.yml circle.yml', {cwd})

  // Add .travis.yml
  console.log('Copying .travis.yml')
  exec('cp ../travis.example.yml .travis.yml', {cwd})
}
