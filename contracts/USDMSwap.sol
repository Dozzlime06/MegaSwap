// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

interface IUSDM is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function decimals() external view returns (uint8);
}

contract USDMSwap is Ownable, ReentrancyGuard {
    IUSDM public usdm;
    AggregatorV3Interface public priceFeed;
    
    uint256 public manualPrice; // 8 decimals (e.g., 300000000000 = $3000)
    bool public useOracle;
    
    uint256 public swapFee = 30; // 0.3% fee (basis points, 10000 = 100%)
    uint256 public constant USDM_DECIMALS = 6;
    uint256 public constant ETH_DECIMALS = 18;
    uint256 public constant PRICE_DECIMALS = 8;
    
    event SwapETHForUSDM(address indexed user, uint256 ethAmount, uint256 usdmAmount, uint256 priceUsed);
    event SwapUSDMForETH(address indexed user, uint256 usdmAmount, uint256 ethAmount, uint256 priceUsed);
    event Withdraw(address indexed owner, uint256 amount);
    event PriceUpdated(uint256 newPrice);

    constructor(address _usdm, address _priceFeed) Ownable(msg.sender) {
        usdm = IUSDM(_usdm);
        if (_priceFeed != address(0)) {
            priceFeed = AggregatorV3Interface(_priceFeed);
            useOracle = true;
        } else {
            manualPrice = 300000000000; // $3000 default
            useOracle = false;
        }
    }

    function getETHPrice() public view returns (uint256) {
        if (useOracle && address(priceFeed) != address(0)) {
            (, int256 price,,,) = priceFeed.latestRoundData();
            require(price > 0, "Invalid oracle price");
            return uint256(price);
        }
        require(manualPrice > 0, "Price not set");
        return manualPrice;
    }

    // Calculate USDM out for ETH in (6 decimals output)
    function calculateUSDMOut(uint256 ethAmount) public view returns (uint256) {
        uint256 price = getETHPrice(); // 8 decimals
        // ethAmount (18 dec) * price (8 dec) / 1e20 = USDM (6 dec)
        uint256 usdmAmount = (ethAmount * price) / 1e20;
        uint256 fee = (usdmAmount * swapFee) / 10000;
        return usdmAmount - fee;
    }

    // Calculate ETH out for USDM in (18 decimals output)
    function calculateETHOut(uint256 usdmAmount) public view returns (uint256) {
        uint256 price = getETHPrice(); // 8 decimals
        require(price > 0, "Invalid price");
        // usdmAmount (6 dec) * 1e20 / price (8 dec) = ETH (18 dec)
        uint256 ethAmount = (usdmAmount * 1e20) / price;
        uint256 fee = (ethAmount * swapFee) / 10000;
        return ethAmount - fee;
    }

    // ETH → USDM: User sends ETH, receives minted USDM
    function swapETHForUSDM() external payable nonReentrant {
        require(msg.value > 0, "Send ETH");
        
        uint256 usdmAmount = calculateUSDMOut(msg.value);
        require(usdmAmount > 0, "Amount too small");
        
        // Mint USDM directly to user
        usdm.mint(msg.sender, usdmAmount);
        
        emit SwapETHForUSDM(msg.sender, msg.value, usdmAmount, getETHPrice());
    }

    // USDM → ETH: User sends USDM, receives ETH
    function swapUSDMForETH(uint256 usdmAmount) external nonReentrant {
        require(usdmAmount > 0, "Amount zero");
        require(usdm.balanceOf(msg.sender) >= usdmAmount, "Insufficient USDM");
        
        uint256 ethAmount = calculateETHOut(usdmAmount);
        require(ethAmount > 0, "Amount too small");
        require(address(this).balance >= ethAmount, "Insufficient ETH liquidity");
        
        // Transfer and burn USDM
        usdm.transferFrom(msg.sender, address(this), usdmAmount);
        usdm.burn(usdmAmount);
        
        // Send ETH to user
        (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        
        emit SwapUSDMForETH(msg.sender, usdmAmount, ethAmount, getETHPrice());
    }

    // ============ OWNER WITHDRAWAL FUNCTIONS ============
    
    // Withdraw specific amount of ETH
    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdraw(owner(), amount);
    }

    // Withdraw ALL ETH - no restrictions
    function withdrawAllETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
        emit Withdraw(owner(), balance);
    }

    // Emergency withdraw - bypasses all checks
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }

    // ============ ADMIN FUNCTIONS ============

    function setManualPrice(uint256 _price) external onlyOwner {
        require(_price > 0, "Invalid price");
        manualPrice = _price;
        emit PriceUpdated(_price);
    }

    function setSwapFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        swapFee = _fee;
    }

    function setOracle(address _priceFeed) external onlyOwner {
        priceFeed = AggregatorV3Interface(_priceFeed);
        useOracle = _priceFeed != address(0);
    }

    // ============ VIEW FUNCTIONS ============

    function getContractETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getContractUSDMBalance() external view returns (uint256) {
        return usdm.balanceOf(address(this));
    }

    receive() external payable {}
}
