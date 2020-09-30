"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestConfirmation = void 0;
class RequestConfirmation {
    getData() {
        try {
            if (this.data == null)
                return null;
            return JSON.parse(this.data);
        }
        catch (Exception) {
            return null;
        }
    }
    getDataAs() {
        return this.getData();
    }
    setData(data) {
        if (data == null)
            this.data = null;
        else
            this.data = JSON.stringify(data);
    }
}
exports.RequestConfirmation = RequestConfirmation;
//# sourceMappingURL=RequestConfirmation.js.map