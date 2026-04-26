import { HttpClient } from "../../utils/http-client.js";
import { AdminNotification } from "../../models/index.js";
import axios from "axios";
import { jest } from "@jest/globals";

describe("HttpClient Auction Integration", () => {
  const url = "http://localhost:3001/api/auctions/123/payment-confirm";
  const data = {
    auctionId: "123",
    orderReference: "ORD-ABC",
    amount: 50000,
    payment_id: "TRANS-789",
    status: "paid"
  };
  const options = { headers: { "x-internal-key": "test-key" } };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("should succeed on first attempt", async () => {
    const spy = jest.spyOn(axios, 'post').mockResolvedValue({ data: { success: true } });

    const result = await HttpClient.postWithRetry(url, data, options, 1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    spy.mockRestore();
  });

  test("should fail and notify admins", async () => {
    const spyPost = jest.spyOn(axios, 'post').mockRejectedValue(new Error("API Error"));
    const spyNotify = jest.spyOn(AdminNotification, 'create').mockResolvedValue({ id: 1 });

    await expect(HttpClient.postWithRetry(url, data, options, 1))
      .rejects.toThrow("API Error");

    expect(spyPost).toHaveBeenCalledTimes(1);
    expect(spyNotify).toHaveBeenCalled();
    
    spyPost.mockRestore();
    spyNotify.mockRestore();
  });
});
