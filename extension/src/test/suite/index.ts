import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000, // 60 second timeout for extension tests
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise(async (resolve, reject) => {
    try {
      // Find all test files
      const files = await glob('**/**.test.js', { cwd: testsRoot });

      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error('Error finding test files:', err);
      reject(err);
    }
  });
}
