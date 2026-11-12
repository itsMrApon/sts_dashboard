export class StsError extends Error {
    constructor(message, code, status, fieldId = null) {
        super(message);
        this.code = code;
        this.status = status;
        this.fieldId = fieldId;
        this.name = 'StsError';
    }
}
