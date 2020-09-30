"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationEvent = void 0;
const Entity_1 = require("./Entity");
class IntegrationEvent extends Entity_1.Entity {
    setObject(obj) {
        // Include type information when serializing JSON 
        this.object_type = this.getTypeName();
        this.object_value = JSON.stringify(obj);
    }
    getObject() {
        return JSON.parse(this.object_value);
    }
    getTypeName() {
        var TCtor;
        var typeName = typeof (TCtor).name;
        return typeName;
    }
}
exports.IntegrationEvent = IntegrationEvent;
//# sourceMappingURL=IntegrationEvent.js.map