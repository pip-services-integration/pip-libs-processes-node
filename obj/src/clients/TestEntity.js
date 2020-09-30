"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestEntity = void 0;
const Entity_1 = require("../data/Entity");
class TestEntity extends Entity_1.Entity {
    toString() {
        return 'Test #' + this.id;
    }
}
exports.TestEntity = TestEntity;
//# sourceMappingURL=TestEntity.js.map