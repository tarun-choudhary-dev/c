export async function runPhase2(page) {
  const real = await page.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    const codeOf = async (promise) => { try { await promise; return null; } catch (error) { return error.code; } };
    const source = "int main(void) { return 0; }";
    const engine = new CEngine({ limits: { executionTimeoutMs: 1000, stdoutBytes: 5, stderrBytes: 8 } });
    const beforeCompile = await codeOf(engine.compile({ source }));
    const beforeRun = await codeOf(engine.run({ source }));
    const beforeExecute = await codeOf(engine.execute({}));
    const idleCancel = await engine.cancel();
    const initialA = engine.initialize();
    const initialB = engine.initialize();
    const sharedInitialization = initialA === initialB;
    await initialA;
    await engine.initialize();
    const initialInfo = engine.getRuntimeInfo();
    const limited = await engine.run({ source: '#include <stdio.h>\nint main(void) { puts("abcdefgh"); return 0; }' });
    const loop = await engine.compile({ source: "int main(void) { for (;;) {} }" });
    const running = engine.execute(loop.artifact);
    const runningCode = codeOf(running);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const cancellation = await engine.cancel();
    const cancelledCode = await runningCode;
    const postCancelState = engine.getState();
    const oldArtifactCode = await codeOf(engine.execute(loop.artifact));
    const afterCancel = await engine.run({ source });
    const resetPromise = engine.reset();
    const resetSame = resetPromise === engine.reset();
    await resetPromise;
    const postResetState = engine.getState();
    const afterReset = await engine.run({ source });
    const secondLoop = await engine.compile({ source: "int main(void) { for (;;) {} }" });
    const runningAgainCode = codeOf(engine.execute(secondLoop.artifact));
    await new Promise((resolve) => setTimeout(resolve, 80));
    await engine.reset();
    const resetRunningCode = await runningAgainCode;
    const postResetRun = await engine.run({ source });
    const disposalA = engine.dispose();
    const disposalB = engine.dispose();
    const sameDisposal = disposalA === disposalB;
    await disposalA;
    const disposedCode = await codeOf(engine.reset());
    return {
      beforeCompile, beforeRun, beforeExecute, idleCancel, sharedInitialization,
      initialInfo: !!initialInfo, limited: limited.execution, cancellation, cancelledCode,
      postCancelState, oldArtifactCode, afterCancel: afterCancel.execution?.exitCode,
      resetSame, postResetState, afterReset: afterReset.execution?.exitCode,
      resetRunningCode, postResetRun: postResetRun.execution?.exitCode,
      sameDisposal, disposedCode, finalState: engine.getState(),
    };
  });

  const synthetic = await page.evaluate(async () => {
    const { CEngine } = await import("/src/index.js");
    const NativeWorker = globalThis.Worker;
    const codeOf = async (promise) => { try { await promise; return null; } catch (error) { return error.code; } };
    const source = "int main(void) { return 0; }";
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const mode = { holdInitialize: false, holdCompile: false, holdExecute: false, faultCompile: false, faultExecute: false, messageErrorCompile: false, malformedCompile: false, staleCompile: false, badGenerationCompile: false, startupFailure: false, throwOnTerminate: false };
    const held = [];
    const instances = [];
    class FakeWorker extends EventTarget {
      constructor(url) {
        super();
        this.role = String(url).includes("compiler") ? "compiler" : "execution";
        if (this.role === "compiler" && mode.startupFailure) { mode.startupFailure = false; throw new Error("synthetic startup failure"); }
        this.throwOnTerminate = mode.throwOnTerminate;
        mode.throwOnTerminate = false;
        this.terminated = false;
        this.requests = [];
        instances.push(this);
      }
      terminate() { this.terminated = true; if (this.throwOnTerminate) throw new Error("synthetic cleanup failure"); }
      reply(request, kind, result) {
        this.dispatchEvent(new MessageEvent("message", { data: { protocolVersion: 1, generation: request.generation, requestId: request.requestId, kind, result } }));
      }
      postMessage(request) {
        this.requests.push(request);
        if (request.kind === "initialize") {
          if (mode.holdInitialize) { mode.holdInitialize = false; held.push({ worker: this, request }); return; }
          queueMicrotask(() => this.reply(request, "initializeResult", { target: "wasm32-wasip1", clang: { version: "fake" }, lld: { version: "fake" }, sysrootBytes: 0, initializationMs: 0 }));
        } else if (request.kind === "compile") {
          if (mode.holdCompile) { mode.holdCompile = false; held.push({ worker: this, request }); return; }
          if (mode.faultCompile) {
            mode.faultCompile = false;
            queueMicrotask(() => { const event = new Event("error"); Object.defineProperty(event, "message", { value: "synthetic Worker fault" }); this.dispatchEvent(event); });
            return;
          }
          if (mode.messageErrorCompile) { mode.messageErrorCompile = false; queueMicrotask(() => this.dispatchEvent(new Event("messageerror"))); return; }
          if (mode.malformedCompile) { mode.malformedCompile = false; queueMicrotask(() => this.reply(request, "compileResult", { status: "success" })); return; }
          if (mode.badGenerationCompile) {
            mode.badGenerationCompile = false;
            queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { protocolVersion: 1, generation: request.generation - 1, requestId: request.requestId, kind: "compileResult", result: {} } })));
            return;
          }
          if (mode.staleCompile) {
            mode.staleCompile = false;
            queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: { protocolVersion: 1, generation: request.generation - 1, requestId: request.requestId - 1, kind: "compileResult", result: {} } })));
          }
          queueMicrotask(() => this.reply(request, "compileResult", { status: "success", stage: "complete", diagnostics: [], rawDiagnostics: "", diagnosticsTruncated: false, durationMs: 0, wasm: new Uint8Array([0, 97, 115, 109]) }));
        } else if (request.kind === "execute") {
          if (mode.holdExecute) { mode.holdExecute = false; held.push({ worker: this, request }); return; }
          if (mode.faultExecute) {
            mode.faultExecute = false;
            queueMicrotask(() => { const event = new Event("error"); Object.defineProperty(event, "message", { value: "synthetic execution fault" }); this.dispatchEvent(event); });
            return;
          }
          queueMicrotask(() => this.reply(request, "executionResult", { status: "exited", stdout: "fake", stderr: "", exitCode: 0, durationMs: 0, error: null, truncated: { stdout: false, stderr: false } }));
        }
      }
    }
    globalThis.Worker = FakeWorker;
    try {
      const invalidConstructors = [
        { limits: { executionTimeoutMs: 0 } }, { limits: { executionTimeoutMs: 15001 } },
        { limits: { stdoutBytes: 0 } }, { limits: { stderrBytes: "5" } },
        { limits: { outputBytes: 5 } }, { assetBaseUrl: "https://example.com/assets" },
      ].every((options) => { try { new CEngine(options); return false; } catch (error) { return error instanceof TypeError; } });

      const engine = new CEngine();
      mode.holdInitialize = true;
      const initialA = engine.initialize();
      const initialB = engine.initialize();
      const sharedInitialization = initialA === initialB && instances.length === 1 && engine.getState() === "initializing";
      const cancelDuringInitialization = await engine.cancel();
      const infoDuringInitialization = engine.getRuntimeInfo();
      const firstInit = held.pop();
      firstInit.worker.reply(firstInit.request, "initializeResult", { target: "wasm32-wasip1", clang: { version: "fake" }, lld: { version: "fake" }, sysrootBytes: 0, initializationMs: 0 });
      await initialA;
      const readyCount = instances.length;
      await engine.initialize();
      const noDuplicateWorker = instances.length === readyCount;
      const invalidLifecycleArguments = [await codeOf(engine.initialize(null)), await codeOf(engine.cancel(null)), await codeOf(engine.reset(null)), await codeOf(engine.dispose(null))];
      const invalidCases = [
        () => engine.compile(), () => engine.compile({ source: "" }), () => engine.compile({ source: "   " }),
        () => engine.compile({ files: [] }), () => engine.compile({ files: [{ path: "a.c", source }, { path: "A.c", source }] }),
        () => engine.compile({ source, filename: "../bad.c" }), () => engine.compile({ source, options: { optimization: "O3" } }),
        () => engine.compile({ source, options: { warnings: null } }), () => engine.compile({ source, stdin: "x" }),
        () => engine.run({ source, stdin: 12 }),
      ];
      const invalidCodes = [];
      for (const invalid of invalidCases) invalidCodes.push(await codeOf(invalid()));
      const invalidArtifact = await codeOf(engine.execute({}));
      const compiled = await engine.compile({ source });
      invalidCodes.push(await codeOf(engine.execute(compiled.artifact, { stdin: 12 })));
      const invalidExecuteOptions = await codeOf(engine.execute(compiled.artifact, { timeoutMs: 1 }));
      const invalidRunOptions = await codeOf(engine.run({ source, timeoutMs: 1 }));
      const exactSource = source + " ".repeat(128 * 1024 - new TextEncoder().encode(source).length);
      const atSourceLimit = (await engine.compile({ source: exactSource })).status;
      const beyondSourceLimit = await codeOf(engine.compile({ source: exactSource + "x" }));
      const beyondFileCount = await codeOf(engine.compile({ files: Array.from({ length: 33 }, (_, i) => ({ path: `f${i}.c`, source })) }));
      const beyondAggregate = await codeOf(engine.compile({ files: Array.from({ length: 5 }, (_, i) => ({ path: `f${i}.c`, source: "x".repeat(110000) })) }));
      const beyondSegments = await codeOf(engine.compile({ source, filename: `${"a/".repeat(16)}main.c` }));
      const nonNormalizedPath = await codeOf(engine.compile({ source, filename: "e\u0301.c" }));
      const beyondStdin = await codeOf(engine.execute(compiled.artifact, { stdin: "x".repeat(128 * 1024 + 1) }));
      const previous = await engine.execute(compiled.artifact);
      const repeated = await engine.execute(compiled.artifact);

      mode.holdCompile = true;
      const compilingCode = codeOf(engine.compile({ source }));
      await tick();
      const heldCompile = held.pop();
      const busyCompile = await codeOf(engine.compile({ source }));
      const busyExecute = await codeOf(engine.execute(compiled.artifact));
      const busyRun = await codeOf(engine.run({ source }));
      const busyInitialize = await codeOf(engine.initialize());
      const busyState = engine.getState() === "busy" && engine.isBusy();
      mode.holdInitialize = true;
      const cancelA = engine.cancel();
      const cancelB = engine.cancel();
      const recoveringState = engine.getState() === "recovering" && engine.isBusy();
      const repeatedCancelSame = cancelA === cancelB;
      const cancelledCompile = await compilingCode;
      const recoveryPending = engine.getState() === "recovering" && engine.isBusy();
      const recoveryInit = held.pop();
      recoveryInit.worker.reply(recoveryInit.request, "initializeResult", { target: "wasm32-wasip1", clang: { version: "fake" }, lld: { version: "fake" }, sysrootBytes: 0, initializationMs: 0 });
      const cancelTrue = await cancelA;
      const compilerTerminated = heldCompile.worker.terminated;
      heldCompile.worker.reply(heldCompile.request, "compileResult", { status: "error", stage: "compile", diagnostics: [], rawDiagnostics: "", durationMs: 0, wasm: null });
      const afterLate = await engine.compile({ source });
      const afterCancelReady = engine.getState() === "ready";
      const cancelIdle = await engine.cancel();
      const invalidatedArtifact = await codeOf(engine.execute(compiled.artifact));

      mode.holdExecute = true;
      const executingCode = codeOf(engine.execute(afterLate.artifact));
      await tick();
      const heldExecution = held.pop();
      const twoExecutions = await codeOf(engine.execute(afterLate.artifact));
      const resetA = engine.reset();
      const resetB = engine.reset();
      const repeatedResetSame = resetA === resetB;
      await resetA;
      const resetExecutionCode = await executingCode;
      const executionTerminated = heldExecution.worker.terminated;
      heldExecution.worker.reply(heldExecution.request, "executionResult", { status: "exited", stdout: "late", stderr: "", exitCode: 0, durationMs: 0, truncated: { stdout: false, stderr: false } });
      const afterReset = await engine.execute((await engine.compile({ source })).artifact);

      mode.faultCompile = true;
      const workerFault = await codeOf(engine.compile({ source }));
      const recoveredAfterFault = engine.getState() === "ready" && (await engine.compile({ source })).status === "success";
      mode.malformedCompile = true;
      const malformed = await codeOf(engine.compile({ source }));
      const recoveredAfterMalformed = engine.getState() === "ready" && (await engine.compile({ source })).status === "success";
      mode.staleCompile = true;
      const staleIgnored = (await engine.compile({ source })).status === "success";
      mode.badGenerationCompile = true;
      const staleGeneration = await codeOf(engine.compile({ source }));
      const afterStaleGeneration = engine.getState() === "ready" && (await engine.compile({ source })).status === "success";

      const immediateCode = codeOf(engine.compile({ source }));
      const immediateCancellation = await engine.cancel();
      const immediateCancelledCode = await immediateCode;
      const afterImmediate = (await engine.compile({ source })).status;

      mode.holdCompile = true;
      const resetCompileCode = codeOf(engine.compile({ source }));
      await tick();
      const resetCompilerWorker = held.pop().worker;
      await engine.reset();
      const resetCompile = await resetCompileCode;
      const afterResetCompile = (await engine.compile({ source })).status;

      mode.faultExecute = true;
      const executionFault = await codeOf(engine.execute((await engine.compile({ source })).artifact));
      const afterExecutionFault = engine.getState() === "ready" && (await engine.execute((await engine.compile({ source })).artifact)).exitCode === 0;
      mode.messageErrorCompile = true;
      const messageError = await codeOf(engine.compile({ source }));
      const afterMessageError = engine.getState() === "ready" && (await engine.compile({ source })).status === "success";

      mode.holdExecute = true;
      mode.throwOnTerminate = true;
      const cleanupOperationCode = codeOf(engine.execute((await engine.compile({ source })).artifact));
      await tick();
      const cleanupWorker = held.pop().worker;
      const cleanupCancel = await engine.cancel();
      const cleanupOriginalCode = await cleanupOperationCode;
      const cleanupRecovered = engine.getState() === "ready" && (await engine.compile({ source })).status === "success";

      mode.holdCompile = true;
      const disposingCode = codeOf(engine.compile({ source }));
      await tick();
      const disposingWorker = held.pop().worker;
      const disposeA = engine.dispose();
      const disposeB = engine.dispose();
      await disposeA;
      const disposedCompile = await disposingCode;
      const disposeSame = disposeA === disposeB;
      const disposeTerminated = disposingWorker.terminated;
      const afterDispose = await codeOf(engine.run({ source }));

      mode.holdInitialize = true;
      const resetDuringInit = new CEngine();
      const oldInitializationCode = codeOf(resetDuringInit.initialize());
      const oldInitWorker = held.pop().worker;
      await resetDuringInit.reset();
      const oldInitReset = await oldInitializationCode;
      const resetInitReady = resetDuringInit.getState() === "ready" && oldInitWorker.terminated;
      await resetDuringInit.dispose();

      const resetFromCreated = new CEngine();
      await resetFromCreated.reset();
      const resetCreatedReady = resetFromCreated.getState() === "ready";
      await resetFromCreated.dispose();

      mode.holdInitialize = true;
      const disposedDuringInit = new CEngine();
      const disposedInitializationCode = codeOf(disposedDuringInit.initialize());
      const disposedInitWorker = held.pop().worker;
      await disposedDuringInit.dispose();
      const disposedInitCode = await disposedInitializationCode;

      mode.startupFailure = true;
      const startup = new CEngine();
      const startupFailure = await codeOf(startup.initialize());
      const startupFailedState = startup.getState();
      await startup.initialize();
      const startupRecovery = startup.getState();
      await startup.dispose();

      return {
        invalidConstructors, sharedInitialization, noDuplicateWorker, cancelDuringInitialization, infoDuringInitialization, invalidLifecycleArguments, invalidCodes, invalidArtifact,
        invalidExecuteOptions, invalidRunOptions, previous, repeated,
        atSourceLimit, beyondSourceLimit, beyondFileCount, beyondAggregate, beyondSegments, nonNormalizedPath, beyondStdin,
        busyCompile, busyExecute, busyRun, busyInitialize, busyState, recoveringState, recoveryPending, repeatedCancelSame, cancelTrue, cancelledCompile,
        compilerTerminated, afterLate: afterLate.status, afterCancelReady, cancelIdle, invalidatedArtifact,
        twoExecutions, repeatedResetSame, resetExecutionCode, executionTerminated, afterReset,
        workerFault, recoveredAfterFault, malformed, recoveredAfterMalformed, staleIgnored, staleGeneration, afterStaleGeneration,
        immediateCancellation, immediateCancelledCode, afterImmediate,
        resetCompile, resetCompilerTerminated: resetCompilerWorker.terminated, afterResetCompile,
        executionFault, afterExecutionFault, messageError, afterMessageError,
        cleanupCancel, cleanupOriginalCode, cleanupTerminated: cleanupWorker.terminated, cleanupRecovered,
        disposedCompile, disposeSame, disposeTerminated, afterDispose,
        oldInitReset, resetInitReady, resetCreatedReady,
        disposedInitCode, disposedInitTerminated: disposedInitWorker.terminated,
        startupFailure, startupFailedState, startupRecovery,
      };
    } finally { globalThis.Worker = NativeWorker; }
  });

  const checks = {
    phase2PreInitialize: real.beforeCompile === "NOT_READY" && real.beforeRun === "NOT_READY" && real.beforeExecute === "NOT_READY" && real.idleCancel === false,
    phase2RepeatedInitialize: real.sharedInitialization && real.initialInfo && synthetic.sharedInitialization && synthetic.noDuplicateWorker && synthetic.cancelDuringInitialization === false && synthetic.infoDuringInitialization === null,
    phase2Validation: synthetic.invalidConstructors && synthetic.invalidLifecycleArguments.every((code) => code === "INVALID_REQUEST") && synthetic.invalidCodes.every((code) => code === "INVALID_REQUEST") && synthetic.invalidArtifact === "INVALID_ARTIFACT" && synthetic.invalidExecuteOptions === "INVALID_REQUEST" && synthetic.invalidRunOptions === "INVALID_REQUEST",
    phase2ValidationBoundaries: synthetic.atSourceLimit === "success" && synthetic.beyondSourceLimit === "LIMIT_EXCEEDED" && synthetic.beyondFileCount === "INVALID_REQUEST" && synthetic.beyondAggregate === "LIMIT_EXCEEDED" && synthetic.beyondSegments === "INVALID_REQUEST" && synthetic.nonNormalizedPath === "INVALID_REQUEST" && synthetic.beyondStdin === "LIMIT_EXCEEDED",
    phase2RepeatedExecution: synthetic.previous.stdout === "fake" && synthetic.repeated.stdout === "fake",
    phase2OutputLimit: real.limited.stdout === "abcde" && real.limited.truncated.stdout === true && real.limited.exitCode === 0,
    phase2CancelExecution: real.cancellation === true && real.cancelledCode === "CANCELLED" && real.postCancelState === "ready" && real.oldArtifactCode === "INVALID_ARTIFACT" && real.afterCancel === 0,
    phase2CancelCompilation: synthetic.repeatedCancelSame && synthetic.cancelTrue && synthetic.cancelledCompile === "CANCELLED" && synthetic.compilerTerminated && synthetic.afterLate === "success" && synthetic.afterCancelReady && synthetic.cancelIdle === false && synthetic.invalidatedArtifact === "INVALID_ARTIFACT",
    phase2OverlappingOperations: synthetic.busyCompile === "BUSY" && synthetic.busyExecute === "BUSY" && synthetic.busyRun === "BUSY" && synthetic.busyInitialize === "BUSY" && synthetic.busyState && synthetic.recoveringState && synthetic.recoveryPending && synthetic.twoExecutions === "BUSY",
    phase2Reset: real.resetSame && real.postResetState === "ready" && real.afterReset === 0 && synthetic.repeatedResetSame && synthetic.resetExecutionCode === "RESET" && synthetic.executionTerminated && synthetic.afterReset.stdout === "fake" && synthetic.resetCreatedReady,
    phase2ResetDuringExecution: real.resetRunningCode === "RESET" && real.postResetRun === 0,
    phase2WorkerFault: synthetic.workerFault === "WORKER_FAILED" && synthetic.recoveredAfterFault,
    phase2MalformedResponse: synthetic.malformed === "PROTOCOL_ERROR" && synthetic.recoveredAfterMalformed,
    phase2StaleResponse: synthetic.staleIgnored,
    phase2StaleGeneration: synthetic.staleGeneration === "PROTOCOL_ERROR" && synthetic.afterStaleGeneration,
    phase2ImmediateCancellation: synthetic.immediateCancellation === true && synthetic.immediateCancelledCode === "CANCELLED" && synthetic.afterImmediate === "success",
    phase2ResetDuringCompilation: synthetic.resetCompile === "RESET" && synthetic.resetCompilerTerminated && synthetic.afterResetCompile === "success",
    phase2ExecutionWorkerFault: synthetic.executionFault === "WORKER_FAILED" && synthetic.afterExecutionFault,
    phase2MessageError: synthetic.messageError === "PROTOCOL_ERROR" && synthetic.afterMessageError,
    phase2CleanupError: synthetic.cleanupCancel === true && synthetic.cleanupOriginalCode === "CANCELLED" && synthetic.cleanupTerminated && synthetic.cleanupRecovered,
    phase2Dispose: real.sameDisposal && real.disposedCode === "DISPOSED" && real.finalState === "disposed" && synthetic.disposedCompile === "DISPOSED" && synthetic.disposeSame && synthetic.disposeTerminated && synthetic.afterDispose === "DISPOSED",
    phase2ResetDuringInitialization: synthetic.oldInitReset === "RESET" && synthetic.resetInitReady,
    phase2DisposeDuringInitialization: synthetic.disposedInitCode === "DISPOSED" && synthetic.disposedInitTerminated,
    phase2StartupFailure: synthetic.startupFailure === "INITIALIZATION_FAILED" && synthetic.startupFailedState === "failed" && synthetic.startupRecovery === "ready",
  };
  return { checks, real, synthetic };
}
