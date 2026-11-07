import { MongoMemoryServer } from 'mongodb-memory-server';

async function diagnose() {
  console.log('1. Creating MongoMemoryServer with verbose logging...');
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'bundlebyte_diagnostics',
    },
  });

  const uri = mongod.getUri();
  console.log('2. Started mongod at:', uri);
  console.log('3. Instance info:', mongod.instanceInfo);

  // Monitor child process
  if (mongod.newChildProcess) {
    console.log('4. Monitoring child process pid:', mongod.newChildProcess.pid);
    mongod.newChildProcess.on('exit', (code, signal) => {
      console.log(`⚠️ Child mongod exited with code: ${code}, signal: ${signal}`);
    });
    mongod.newChildProcess.on('error', (err) => {
      console.error('⚠️ Child mongod error:', err);
    });
    mongod.newChildProcess.stdout?.on('data', (d) => {
      const line = d.toString();
      if (line.includes('ERROR') || line.includes('FATAL') || line.includes('shutdown') || line.includes('exit')) {
        console.log('[mongod stdout]:', line);
      }
    });
    mongod.newChildProcess.stderr?.on('data', (d) => {
      console.log('[mongod stderr]:', d.toString());
    });
  }

  console.log('5. Waiting 40 seconds to observe stability...');
  for (let i = 1; i <= 8; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    console.log(`   Heartbeat ${i*5}s: mongod.state = ${mongod.state}, isRunning = ${mongod.state === 'running'}`);
  }

  console.log('6. Diagnostic test finished successfully. Stopping server.');
  await mongod.stop();
  console.log('7. Stopped.');
}

diagnose().catch(console.error);

