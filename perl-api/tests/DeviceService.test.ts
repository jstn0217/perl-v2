import { DeviceService } from '../src/services/DeviceService.js';
import { createRepositories, describeForDataLayers } from './helpers/dataLayer.js';

describeForDataLayers('DeviceService.registerDevice id generation', (dataLayer) => {
  it('assigns unique IDs even when many devices are registered for the same school in the same millisecond', async () => {
    const repositories = createRepositories(dataLayer);
    const service = new DeviceService(repositories.deviceRepository);

    const registered = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        service.registerDevice('school-st-marys', `Device ${index}`, `Location ${index}`)
      )
    );

    const ids = registered.map((entry) => entry.device.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
